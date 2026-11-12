import '../config/env.js'; // ensures .env is loaded before Prisma reads DATABASE_URL
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export default prisma;
