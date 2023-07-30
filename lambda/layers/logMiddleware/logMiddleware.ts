import { Callback, Context, Handler } from 'aws-lambda';

interface ExtendedContext extends Context {
    logger?: {
        log: (...args: any[]) => void;
        error: (...args: any[]) => void;
    };
}

export const logMiddleware = (handler: Handler) => {
    return async (event: any, context: ExtendedContext, callback: Callback) => {
        try {
            const { requestContext, body } = event;
            const userId = requestContext?.authorizer?.claims["cognito:username"] ||
                requestContext?.authorizer?.claims?.username ||
                "Anonymous";

            const logger = {
                log: (...args: any[]) => console.log(` userId: ${userId} , `, ...args),
                error: (...args: any[]) => console.error(` userId: ${userId} , `, ...args),
            };

            context.logger = logger;

            const result: any = await handler(event, context, callback);

            const response = {
                requestId: requestContext?.requestId,
                time: requestContext?.requestTime,
                method: requestContext?.httpMethod,
                endpointUrl: `${requestContext?.domainName}${requestContext?.path}`,
                status: result?.statusCode,
                requestBody: body,
                responseBody: result,
            };

            logger.log(` Response:`, response);

            return result;
        } catch (err) {
            context.logger?.error('An error occurred:', err);
            throw err;
        }
    };
};
