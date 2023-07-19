import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient({
    datasources: {
        db: {
            url: process.env.DATABASE_URL,
            provider: 'mysql',
            config: {
                ssl: true,
            },
        },
    },
});

export default prisma;
