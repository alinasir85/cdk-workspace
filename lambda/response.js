exports.handler = async (event) => {
    console.log("Response from SQS: ", event)
    try {
        const message = JSON.parse(event.Records[0].body);
        const messageBody = JSON.parse(message.Message);
        if (messageBody && messageBody.Message) {
            const counter = messageBody.Message.split(':')[1].trim();
            console.log("counter from SQS: ", counter);
            return {
                headers: { 'Content-Type': 'text/plain' },
                body: JSON.stringify(`You've hit the URL ${counter} times!`),
                statusCode: 200,
            };
        } else {
            console.log("Invalid message format from SQS");
            return {
                headers: { 'Content-Type': 'text/plain' },
                body: JSON.stringify('Invalid message format from SQS.'),
                statusCode: 400,
            };
        }
    } catch (error) {
        console.log("Error occurred while processing the message: ", error);
        return {
            headers: { 'Content-Type': 'text/plain' },
            body: JSON.stringify('Error occurred while processing the message.'),
            statusCode: 500,
        };
    }
};
