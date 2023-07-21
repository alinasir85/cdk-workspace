const {Lambda} = require('aws-sdk');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient({
    datasources: {
        db: {
            url: process.env.DATABASE_URL,
        },
    },
});

exports.handler = async function (event) {
    console.log("request:", JSON.stringify(event,undefined,2));
    const lambda = new Lambda();
    const id = 0;
    const existingHit = await prisma.hits.findUnique({ where: { id } });
    console.log("existingHit: ",existingHit)
    if (existingHit) {
        await prisma.hits.update({
            where: { id },
            data: { counter: existingHit.counter + 1 },
        });
    } else {
        await prisma.hits.create({
            data: { id, counter: 1 },
        });
    }
    const resp = await lambda.invoke({
        FunctionName: process.env.DOWNSTREAM_FUNCTION_NAME,
        Payload: JSON.stringify(event)
    }).promise();
    console.log('response: ',JSON.stringify(resp,undefined,2));
    return JSON.parse(resp.Payload);
}