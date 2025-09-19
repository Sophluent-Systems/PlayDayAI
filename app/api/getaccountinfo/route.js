import handler from '@src/api/getaccountinfo';
import { createRouteHandler } from '@src/backend/apiRouteAdapter';

const route = createRouteHandler(handler);

export const GET = route;
export const POST = route;
export const PUT = route;
export const DELETE = route;
export const PATCH = route;
export const OPTIONS = route;
export const HEAD = route;

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
