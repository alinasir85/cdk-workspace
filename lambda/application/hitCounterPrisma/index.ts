const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient({
    datasources: {
        db: {
            url: process.env.DATABASE_URL,
        },
    },
});
exports.handler = async function (event) {
    console.log("REQUEST:", event);
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
    return {
        statusCode: 200,
        headers: { "Content-Type": "application/json" },
        body: `You've hit URL ${newCounterValue} times!`,
    };
}