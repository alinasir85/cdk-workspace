import {logMiddleware} from "/opt/logMiddleware/logMiddleware";
import {APIGatewayEvent} from "aws-lambda";

exports.handler = logMiddleware(async function (event: APIGatewayEvent,context: any) {
    context.logger.log("*****  In Hello ********");
    const error = event?.queryStringParameters?.error;
    if(error) {
        return {
            statusCode: error,
            body: JSON.stringify({
                message: "An Error Occurred",
            })
        };
    }
    return {
        statusCode: 200,
        body: JSON.stringify({
            message: "Hello World",
        })
    };
});