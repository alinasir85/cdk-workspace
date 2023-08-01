import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import axios from 'axios';

const RESPONSE_PREFIX = 'Response: ';
const ERROR_MISSING_USER_ID = 'Missing userId parameter';
const ERROR_MISSING_PAGE_NO = 'Missing pageNo parameter';
const ERROR_PROCESSING_REQUEST = 'An error occurred while processing your request.';
const ERROR_OPEN_SEARCH_CREDS = 'OPENSEARCH_USERNAME and OPENSEARCH_PASSWORD must be defined in environment variables.'

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
    try {
        const userId = event?.queryStringParameters?.userId;
        const pageNo = parseInt(event?.queryStringParameters?.pageNo ?? '1');
        const pageSize = parseInt(process.env.PAGE_SIZE ?? '10');
        const OPENSEARCH_URL = process.env.OPENSEARCH_URL as string;
        const username = process.env.OPENSEARCH_USERNAME;
        const password = process.env.OPENSEARCH_PASSWORD;
        const from = pageSize * (pageNo - 1);
        if (!userId) {
            return createResponse(400, ERROR_MISSING_USER_ID);
        }
        if (!pageNo) {
            return createResponse(400, ERROR_MISSING_PAGE_NO);
        }
        if (!username || !password) {
            return createResponse(500, ERROR_OPEN_SEARCH_CREDS);
        }
        const config = {
            auth: { username, password },
        };
        const body = {
            from: from,
            size: pageSize,
            query: {
                bool: {
                    must: [
                        { match_phrase: { "@message": "endpointUrl" } },
                        { match_phrase: { "@message": `userId: ${userId}` } },
                    ],
                },
            },
            sort: [{ "@timestamp": { order: "desc" } }],
        };
        const response = await axios.post(OPENSEARCH_URL, body, config);
        const parsedResults = response.data.hits.hits.map((hit:any) => parseLogEntry(hit._source['@message'])).filter(Boolean);
        return createResponse(200, parsedResults);
    } catch (error) {
        console.error(error);
        return createResponse(500, ERROR_PROCESSING_REQUEST);
    }
};

const extractValue = (pattern: RegExp, str: string) => {
    const match = str.match(pattern);
    return match ? match[1] : null;
};

const parseJsonString = (jsonString: string | null) => {
    try {
        return jsonString ? JSON.parse(jsonString.replace(/^'/, '').replace(/'$/, '').replace(/\\r\\n/g, '').replace(/\\'/g, "'").replace(/\\"/g, '"').replace(/\\\\/g, '\\')) : null;
    } catch (error) {
        console.error("Failed to parse JSON string:", jsonString, error);
        return null;
    }
};

const parseLogEntry = (message: string) => {
    const responseString = message.slice(message.indexOf(RESPONSE_PREFIX) + RESPONSE_PREFIX.length);
    console.log("responseString: ",responseString)
    const responseBody = extractValue(/responseBody:\s*({[\s\S]*?}\s*})/, responseString);
    console.log("responseBody: ", responseBody);
    let extractedRespBody;
    if(responseBody) {
        extractedRespBody = extractValue(/body: ('{.*}')/, responseBody)
        console.log("extractedRespBody: ", extractedRespBody);
    }
    return {
        requestId: extractValue(/requestId: '([^']*)'/, responseString),
        date: extractValue(/date: '([^']*)'/, responseString),
        time: parseInt(extractValue(/time: (\d+)/, responseString) || '0',10),
        method: extractValue(/method: '([^']*)'/, responseString),
        endpointUrl: extractValue(/endpointUrl: '([^']*)'/, responseString),
        status: parseInt(extractValue(/status: '?(\d+)'?/, responseString) || '0', 10),
        requestBody: parseJsonString(extractValue(/requestBody: '({[^]*?})'/, responseString)),
        responseBody: extractedRespBody ? parseJsonString(extractedRespBody) : extractedRespBody,
    };
};

const createResponse = (statusCode: number, body: any) => ({
    statusCode,
    body: JSON.stringify(body),
});
