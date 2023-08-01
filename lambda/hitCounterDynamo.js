const AWS = require('aws-sdk');
const dynamoDB = new AWS.DynamoDB.DocumentClient();
const sns = new AWS.SNS();

exports.handler = async function (event) {
    console.log('request:', JSON.stringify(event, undefined, 2));
    const id = 0;
    let newCounterValue = 0;
    try {
        const getParams = {
            TableName: process.env.HITS_TABLE_NAME,
            Key: { id },
        };
        const existingHit = await dynamoDB.get(getParams).promise();
        if (existingHit.Item) {
            const updateParams = {
                TableName: process.env.HITS_TABLE_NAME,
                Key: { id },
                UpdateExpression: 'SET #counter = :newCounter',
                ExpressionAttributeNames: { '#counter': 'counter' },
                ExpressionAttributeValues: { ':newCounter': existingHit.Item.counter + 1 },
                ReturnValues: 'UPDATED_NEW',
            };
            await dynamoDB.update(updateParams).promise();
        } else {
            const createParams = {
                TableName: process.env.HITS_TABLE_NAME,
                Item: { id, counter: 1 },
            };
            await dynamoDB.put(createParams).promise();
        }
        newCounterValue = existingHit.Item ? existingHit.Item.counter + 1 : 1;
        await sns.publish({
            TopicArn: process.env.HITS_TOPIC_ARN,
            Message: JSON.stringify({counter: newCounterValue }),
        }).promise();
    } catch (error) {
        console.error('Error:', error);
    }
};
