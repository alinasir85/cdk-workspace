import {logMiddleware} from "/opt/logMiddleware/logMiddleware";
import {APIGatewayEvent} from "aws-lambda";
/*
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient({
    datasources: {
        db: {
            url: process.env.DATABASE_URL,
        },
    },
});
*/

exports.handler = logMiddleware(async function (event: APIGatewayEvent,context: any) {
    context.logger.log("*****  In hitCounter ***********");
    const id = 0;
    /*    const existingHit = await prisma.hits.findUnique({ where: { id } });
    if (existingHit) {
        await prisma.hits.update({
            where: { id },
            data: { counter: existingHit.counter + 1 },
        });
    } else {
        await prisma.hits.create({
            data: { id, counter: 1 },
        });
    }*/
    const newCounterValue = Math.round(Math.random());
    context.logger.log(" returning : ", newCounterValue);
    return {
        statusCode: 200,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            message: `You have hit URL ${newCounterValue} times`
        })
    };
});