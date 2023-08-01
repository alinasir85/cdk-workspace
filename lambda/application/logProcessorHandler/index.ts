import * as https from 'https';
import * as zlib from 'zlib';
import * as crypto from 'crypto';

interface LogEvent {
    timestamp: number;
    id: string;
    message: string;
    extractedFields?: Record<string, string>;
}

interface Payload {
    messageType: string;
    logEvents: LogEvent[];
    owner: string;
    logGroup: string;
    logStream: string;
}

interface ElasticsearchAction {
    index: {
        _index?: string;
        _id?: string;
    };
}

const endpoint = process.env.OPENSEARCH_URL;
const logFailedResponses = false;

exports.handler = (input: { awslogs: { data: string } }, context: any) => {

    console.log("************  In logProcessorHandler ***************");
    const zippedInput = Buffer.from(input.awslogs.data, 'base64');

    zlib.gunzip(zippedInput, (error, buffer) => {
        if (error) { context.fail(error); return; }
        const awslogsData: Payload = JSON.parse(buffer.toString('utf8'));
        const elasticsearchBulkData = transform(awslogsData);

        if (!elasticsearchBulkData) {
            console.log('Received a control message');
            context.succeed('Control message handled successfully');
            return;
        }

        post(elasticsearchBulkData, (err, success, statusCode, failedItems) => {
            console.log('Response: ' + JSON.stringify({ "statusCode": statusCode }));

            if (err) {
                logFailure(err, failedItems);
                context.fail(JSON.stringify(err));
            } else {
                console.log('Success: ' + JSON.stringify(success));
                context.succeed('Success');
            }
        });
    });
};

function transform(payload: Payload): string | null {
    if (payload.messageType === 'CONTROL_MESSAGE') {
        return null;
    }

    let bulkRequestBody = '';

    payload.logEvents.forEach(logEvent => {
        const timestamp = new Date(logEvent.timestamp * 1);
        const indexName = `cwl-${timestamp.getUTCFullYear()}-${('0' + (timestamp.getUTCMonth() + 1)).slice(-2)}-${('0' + timestamp.getUTCDate()).slice(-2)}`;
        const source = buildSource(logEvent.message, logEvent.extractedFields);
        source['@id'] = logEvent.id;
        source['@timestamp'] = new Date(logEvent.timestamp * 1).toISOString();
        source['@message'] = logEvent.message;
        source['@owner'] = payload.owner;
        source['@log_group'] = payload.logGroup;
        source['@log_stream'] = payload.logStream;

        const action: ElasticsearchAction = { "index": {} };
        action.index._index = indexName;
        action.index._id = logEvent.id;

        bulkRequestBody += [
            JSON.stringify(action),
            JSON.stringify(source),
        ].join('\n') + '\n';
    });
    return bulkRequestBody;
}

function buildSource(message: string, extractedFields?: Record<string, string>): any {
    if (extractedFields) {
        const source: Record<string, any> = {};
        for (const key in extractedFields) {
            if (Object.prototype.hasOwnProperty.call(extractedFields, key) && extractedFields[key]) {
                const value = extractedFields[key];

                if (isNumeric(value)) {
                    source[key] = Number(value);
                    continue;
                }

                const jsonSubString = extractJson(value);
                if (jsonSubString !== null) {
                    source['$' + key] = JSON.parse(jsonSubString);
                }

                source[key] = value;
            }
        }
        return source;
    }

    const jsonSubString = extractJson(message);
    if (jsonSubString !== null) {
        return JSON.parse(jsonSubString);
    }

    return {};
}

function extractJson(message: string): string | null {
    const jsonStart = message.indexOf('{');
    if (jsonStart < 0) return null;
    const jsonSubString = message.substring(jsonStart);
    return isValidJson(jsonSubString) ? jsonSubString : null;
}

function isValidJson(message: string): boolean {
    try {
        JSON.parse(message);
    } catch (e) { return false; }
    return true;
}

function isNumeric(n: string): boolean {
    return !isNaN(parseFloat(n)) && isFinite(Number(n));
}

function post(body: string, callback: (error?: any, success?: any, statusCode?: number, failedItems?: any) => void): void {
    const requestParams = buildRequest(endpoint, body);

    const request = https.request(requestParams, response => {
        let responseBody = '';
        response.on('data', chunk => {
            responseBody += chunk;
        });

        response.on('end', () => {
            const info = JSON.parse(responseBody);
            let failedItems;
            let success;
            let error;

            if (response.statusCode! >= 200 && response.statusCode! < 299) {
                failedItems = info.items.filter((x: any) => x.index.status >= 300);

                success = {
                    "attemptedItems": info.items.length,
                    "successfulItems": info.items.length - failedItems.length,
                    "failedItems": failedItems.length
                };
            }

            if (response.statusCode !== 200 || info.errors === true) {
                delete info.items;
                error = {
                    statusCode: response.statusCode,
                    responseBody: info
                };
            }

            callback(error, success, response.statusCode!, failedItems);
        });
    }).on('error', e => {
        callback(e);
    });
    // @ts-ignore
    request.end(requestParams.body);
}


function buildRequest(endpoint: string, body: string): https.RequestOptions {
    const endpointParts = endpoint.match(/^([^\.]+)\.?([^\.]*)\.?([^\.]*)\.amazonaws\.com$/);
    const region = endpointParts![2];
    const service = endpointParts![3];
    const datetime = (new Date()).toISOString().replace(/[:\-]|\.\d{3}/g, '');
    const date = datetime.substr(0, 8);
    const kDate = hmac('AWS4' + process.env.AWS_SECRET_ACCESS_KEY!, date);
    const kRegion = hmac(kDate, region);
    const kService = hmac(kRegion, service);
    const kSigning = hmac(kService, 'aws4_request');

    const request: https.RequestOptions = {
        host: endpoint,
        method: 'POST',
        path: '/_bulk',
        headers: {
            'Content-Type': 'application/json',
            'Host': endpoint,
            'Content-Length': Buffer.byteLength(body),
            'X-Amz-Security-Token': process.env.AWS_SESSION_TOKEN!,
            'X-Amz-Date': datetime
        }
    };

    const canonicalHeaders = Object.keys(request.headers)
        .sort((a, b) => (a.toLowerCase() < b.toLowerCase() ? -1 : 1))
        .map(k => `${k.toLowerCase()}:${request.headers?.[k as keyof https.RequestOptions['headers']]}`)
        .join('\n');

    const signedHeaders = Object.keys(request.headers)
        .map(k => k.toLowerCase())
        .sort()
        .join(';');

    const canonicalString = [
        request.method,
        request.path,
        '',
        canonicalHeaders,
        '',
        signedHeaders,
        hash(body, 'hex')
    ].join('\n');

    const credentialString = [date, region, service, 'aws4_request'].join('/');

    const stringToSign = [
        'AWS4-HMAC-SHA256',
        datetime,
        credentialString,
        hash(canonicalString, 'hex')
    ].join('\n');

    // @ts-ignore
    request.headers.Authorization = [
        `AWS4-HMAC-SHA256 Credential=${process.env.AWS_ACCESS_KEY_ID!}/${credentialString}`,
        `SignedHeaders=${signedHeaders}`,
        `Signature=${hmac(kSigning, stringToSign, 'hex')}`
    ].join(', ');

    return request;
}

function hmac(key: string, str: string, encoding?: crypto.BinaryToTextEncoding): string {
    // @ts-ignore
    return crypto.createHmac('sha256', key).update(str, 'utf8').digest(encoding as crypto.HexBase64Latin1Encoding);
}

function hash(str: string, encoding: crypto.BinaryToTextEncoding): string {
    // @ts-ignore
    return crypto.createHash('sha256').update(str, 'utf8').digest(encoding as crypto.HexBase64Latin1Encoding);
}

function logFailure(error: any, failedItems?: any[]): void {
    if (logFailedResponses) {
        console.log('Error: ' + JSON.stringify(error, null, 2));

        if (failedItems && failedItems.length > 0) {
            console.log("Failed Items: " +
                JSON.stringify(failedItems, null, 2));
        }
    }
}