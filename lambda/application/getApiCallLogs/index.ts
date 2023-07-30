import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import axios from 'axios';

const RESPONSE_PREFIX = 'Response: ';
const ERROR_PARSING_LOG = "Failed to parse log entry:";
const ERROR_MISSING_USER_ID = 'Missing userId parameter';
const ERROR_MISSING_PAGE_NO = 'Missing pageNo parameter';
const ERROR_PROCESSING_REQUEST = 'An error occurred while processing your request.';

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
    try {
        const userId = event?.queryStringParameters?.userId;
        const pageNo = event?.queryStringParameters?.pageNo;
        const pageSize = process.env.PAGE_SIZE || 10;
        if (!userId) {
            return createResponse(400, ERROR_MISSING_USER_ID);
        }
        if (!pageNo) {
            return createResponse(400, ERROR_MISSING_PAGE_NO);
        }
        const OPENSEARCH_URL = process.env.OPENSEARCH_URL;
        const config = {
            auth: {
                username: process.env.OPENSEARCH_USERNAME,
                password: process.env.OPENSEARCH_PASSWORD,
            },
        };
        const body = {
            from: pageSize * (pageNo - 1),
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
        const parsedResults = response.data.hits.hits.map(hit => parseLogEntry(hit._source['@message'])).filter(Boolean);
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
    const responseBody = extractValue(/body: ('{.*}')/, responseString);
    if (!responseBody) {
        console.error(ERROR_PARSING_LOG, responseString);
        return null;
    }

    return {
        requestId: extractValue(/requestId: '([^']*)'/, responseString),
        time: extractValue(/time: '([^']*)'/, responseString),
        method: extractValue(/method: '([^']*)'/, responseString),
        endpointUrl: extractValue(/endpointUrl: '([^']*)'/, responseString),
        status: parseInt(extractValue(/status: (\d+)/, responseString) || '0', 10),
        requestBody: parseJsonString(extractValue(/requestBody: '({[^]*?})'/, responseString)),
        responseBody: parseJsonString(responseBody),
    };
};

const createResponse = (statusCode: number, body: any) => ({
    statusCode,
    body: JSON.stringify(body),
});
