import {logMiddleware} from "/opt/logMiddleware/logMiddleware";
import {APIGatewayEvent} from "aws-lambda";
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient({
    datasources: {
        db: {
            url: process.env.DATABASE_URL,
        },
    },
});

exports.handler = logMiddleware(async function (event: APIGatewayEvent,context: any) {
    context.logger.log("*****  In hitCounter ***********");
    const id = 0;
    const existingHit = await prisma.hits.findUnique({ where: { id } });
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
    const newCounterValue = existingHit ? existingHit.counter + 1 : 1;
    context.logger.log(" returning : ", newCounterValue);
    return {
        statusCode: 200,
        headers: { "Content-Type": "application/json" },
        body: `You've hit URL ${newCounterValue} times!`,
    };
});