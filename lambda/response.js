const AWS = require("aws-sdk");
const sns = new AWS.SNS();

exports.handler = async (event) => {
    console.log("\nResponse from SQS: ", event)
    try {
        const message = JSON.parse(event.Records[0].body);
        const messageBody = JSON.parse(message.Message);
        if (messageBody) {
            const counter = messageBody.counter;
            const topicArn = messageBody.topicArn;
            const fromHitCounter = messageBody.fromHitCounter;
            if(fromHitCounter) {
                console.log("\ncounter from SQS: ", counter);
                console.log("\ntopicArn from SQS: ", topicArn);
                await sns.publish({
                    TopicArn: topicArn,
                    Message:  JSON.stringify({message:`You've hit URL ${counter} times!`})
                }).promise();
            }
        }
    } catch (error) {
        console.log("Error occurred while processing the message: ", error);
    }
};
