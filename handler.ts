import { CloudFrontRequestHandler, CloudFrontHeaders } from "aws-lambda";
import "source-map-support/register";

const sourceCoookie = "X-Source";
const sourceA = "a";
const sourceB = "b";
const bBucketName = "ab-test-b.s3.amazonaws.com";
const cookiePath = "/";

export const cookie: CloudFrontRequestHandler = (event, _, callback) => {
  const request = event.Records[0].cf.request;
  const headers = request.headers;

  if (headers.cookie) {
    for (let i = 0; i < headers.cookie.length; i++) {
      if (headers.cookie[i].value.indexOf(sourceCoookie) >= 0) {
        callback(null, request);
        return;
      }
    }
  }

  const source = Math.random() < 0.5 ? sourceB : sourceA;
  console.log(`Source: ${source}`);

  const cookie = `${sourceCoookie}=${source}`;
  headers.cookie = headers.cookie || [];
  headers.cookie.push({ key: "Cookie", value: cookie });

  callback(null, request);
};

export const test: CloudFrontRequestHandler = (event, _, callback) => {
  const request = event.Records[0].cf.request;
  const headers = request.headers;

  const source = decideSource(headers);
  if (source === sourceB) {
    const backet: {
      authMethod: "origin-access-identity" | "none";
      domainName: string;
      path: string;
      region: string;
      customHeaders: CloudFrontHeaders | null;
    } = {
      authMethod: "none",
      domainName: bBucketName,
      path: "",
      region: "",
      customHeaders: {},
    };
    request.origin = { s3: backet };

    headers["host"] = [{ key: "host", value: bBucketName }];
  }

  callback(null, request);
};

export const originCookie = (event, _, callback) => {
  const request = event.Records[0].cf.request;
  const requestHeaders = request.headers;
  const response = event.Records[0].cf.response;

  const sourceACookie = `${sourceCoookie}=${sourceA}`;
  const sourceBCookie = `${sourceCoookie}=${sourceB}`;

  // Look for Source cookie
  // A single cookie header entry may contains multiple cookies, so it looks for a partial match
  if (requestHeaders.cookie) {
    for (let i = 0; i < requestHeaders.cookie.length; i++) {
      if (requestHeaders.cookie[i].value.indexOf(sourceBCookie) >= 0) {
        console.log("Experiment Source cookie found");
        setCookie(response, sourceBCookie);
        callback(null, response);
        return;
      }
      if (requestHeaders.cookie[i].value.indexOf(sourceACookie) >= 0) {
        console.log("Main Source cookie found");
        setCookie(response, sourceACookie);
        callback(null, response);
        return;
      }
    }
  }
  callback(null, response);
};

const setCookie = function (response, cookie) {
  const cookieValue = `${cookie}; Path=${cookiePath}`;
  console.log(`Setting cookie ${cookieValue}`);
  response.headers["set-cookie"] = [{ key: "Set-Cookie", value: cookieValue }];
};

const decideSource = function (headers) {
  const sourceACookie = `${sourceCoookie}=${sourceA}`;
  const sourceBCookie = `${sourceCoookie}=${sourceB}`;

  if (headers.cookie) {
    for (let i = 0; i < headers.cookie.length; i++) {
      if (headers.cookie[i].value.indexOf(sourceACookie) >= 0) {
        return sourceA;
      }
      if (headers.cookie[i].value.indexOf(sourceBCookie) >= 0) {
        return sourceB;
      }
    }
  }
};
