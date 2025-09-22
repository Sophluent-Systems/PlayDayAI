import { NextResponse } from "next/server";
import { Buffer } from "buffer";

const SUPPORTED_METHODS = ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS", "HEAD"];

function buildQuery(url, params) {
  const query = {};

  url.searchParams.forEach((value, key) => {
    if (Object.prototype.hasOwnProperty.call(query, key)) {
      const existing = query[key];
      if (Array.isArray(existing)) {
        existing.push(value);
      } else {
        query[key] = [existing, value];
      }
    } else {
      query[key] = value;
    }
  });

  if (params) {
    for (const [key, value] of Object.entries(params)) {
      query[key] = value;
    }
  }

  return query;
}

async function parseRequestBody(request) {
  const method = request.method?.toUpperCase();
  if (!method || method === "GET" || method === "HEAD") {
    return {};
  }


  const contentType = request.headers.get("content-type") || "";

  if (contentType.includes("application/json")) {
    let data = {};
    try {
      data = await request.json();
      data = data;
    } catch (error) {
      console.error("++++ apiRouteAdapter: error parsing json: ", error);
      // Print the method and the request url
      console.log("++++ apiRouteAdapter: method: ", method);
      console.log("++++ apiRouteAdapter: request url: ", request.url);
    } 
    return { body: data };
  }

  if (contentType.includes("application/x-www-form-urlencoded")) {
    const formData = await request.formData();
    const body = {};
    formData.forEach((value, key) => {
      body[key] = value;
    });
    return { body };
  }

  if (contentType.includes("multipart/form-data")) {
    const formData = await request.formData();
    const body = {};
    const fileList = [];
    const fileMap = {};

    for (const [key, value] of formData.entries()) {
      if (typeof File !== "undefined" && value instanceof File) {
        const buffer = Buffer.from(await value.arrayBuffer());
        const file = {
          fieldname: key,
          originalname: value.name,
          mimetype: value.type,
          size: value.size,
          buffer,
        };
        fileList.push(file);
        if (!fileMap[key]) {
          fileMap[key] = [];
        }
        fileMap[key].push(file);
      } else {
        body[key] = value;
      }
    }

    const result = { body };
    if (fileList.length > 0) {
      result.file = fileList[0];
      result.files = fileList;
      result.fileMap = fileMap;
    }
    return result;
  }

  const text = await request.text();
  return { body: text };
}

function buildHeaders(request) {
  const headers = Object.create(null);
  request.headers.forEach((value, key) => {
    headers[key.toLowerCase()] = value;
  });
  return headers;
}

function buildCookies(request) {
  const cookieHeader = request.headers.get("cookie") || "";
  const cookies = Object.create(null);
  if (cookieHeader) {
    cookieHeader.split(";").forEach((part) => {
      const [name, ...rest] = part.trim().split("=");
      if (!name) {
        return;
      }
      cookies[name] = decodeURIComponent(rest.join("="));
    });
  }
  return cookies;
}

function createResponseBridge() {
  let statusCode = 200;
  let headers = new Map();
  let body = null;
  let ended = false;

  const setHeader = (name, value) => {
    headers.set(name.toLowerCase(), value);
  };

  const res = {
    status(code) {
      statusCode = code;
      return res;
    },
    setHeader,
    getHeader(name) {
      return headers.get(name.toLowerCase());
    },
    json(payload) {
      body = JSON.stringify(payload);
      setHeader("content-type", "application/json; charset=utf-8");
      ended = true;
      return res;
    },
    send(payload) {
      if (payload instanceof Buffer) {
        body = payload;
      } else if (payload instanceof ArrayBuffer) {
        body = Buffer.from(payload);
      } else if (typeof payload === "object") {
        body = JSON.stringify(payload);
        if (!headers.has("content-type")) {
          setHeader("content-type", "application/json; charset=utf-8");
        }
      } else {
        body = payload;
        if (!headers.has("content-type")) {
          setHeader("content-type", "text/plain; charset=utf-8");
        }
      }
      ended = true;
      return res;
    },
    end(payload) {
      if (typeof payload !== "undefined") {
        res.send(payload);
      } else {
        ended = true;
      }
      return res;
    },
    redirect(url, code = 302) {
      statusCode = code;
      setHeader("location", url);
      ended = true;
      return res;
    },
    get statusCode() {
      return statusCode;
    },
    set statusCode(code) {
      statusCode = code;
    },
    get finished() {
      return ended;
    },
  };

  const toNextResponse = () => {
    if (!ended && body === null) {
      body = null;
    }

    const responseHeaders = new Headers();
    headers.forEach((value, key) => {
      responseHeaders.set(key, value);
    });

    if (body instanceof Buffer || body instanceof Uint8Array) {
      return new NextResponse(body, { status: statusCode, headers: responseHeaders });
    }

    return new NextResponse(body, { status: statusCode, headers: responseHeaders });
  };

  return { res, toNextResponse };
}

export function createRouteHandler(handler) {
  return async function routeHandler(request, context) {
    const url = new URL(request.url);
    const query = buildQuery(url, context?.params);
    const { body, file, files, fileMap } = await parseRequestBody(request);
    const apiBody = typeof body === "undefined" ? {} : body;

    const headers = buildHeaders(request);
    const cookies = buildCookies(request);

    const req = {
      method: request.method,
      headers,
      query,
      body: apiBody,
      cookies,
      url: url.pathname + url.search,
      socket: {},
    };

    req.nextRequest = request;
    if (!req.routeParams && context?.params) {
      req.routeParams = context.params;
    }

    if (file) {
      req.file = file;
    }
    if (fileMap) {
      req.files = fileMap;
    } else if (files) {
      req.files = files;
    }

    const { res, toNextResponse } = createResponseBridge();

    try {
      await handler(req, res);
    } catch (error) {
      if (!res.finished) {
        res.status(500).json({ error: { message: error.message } });
      }
      return toNextResponse();
    }

    return toNextResponse();
  };
}

export function createRouteHandlersForAllMethods(handler) {
  const route = createRouteHandler(handler);
  const result = {};
  SUPPORTED_METHODS.forEach((method) => {
    result[method] = route;
  });
  return result;
}
