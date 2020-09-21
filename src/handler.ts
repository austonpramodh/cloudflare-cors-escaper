import urlJoin from "url-join";
import isUrl from "is-url";
import { parseUrl, stringify } from "query-string";
const fwdUrlKey = process.env.FORWARD_URL_KEY;

const fetchResponse = async (url: string, { headers, method, body }: RequestInit): Promise<Response> => {
    return fetch(url, { method, headers, body });
};

export async function handleRequest(request: Request): Promise<Response> {
    try {
        if (request.method.toLowerCase() === "options") {
            return new Response(null, {
                status: 200,
                headers: {
                    "Access-Control-Allow-Origin": "*",
                    "Access-Control-Allow-Headers": "*",
                },
            });
        }
        //key in params of newly forming url
        const queryParams = parseUrl(request.url).query;

        //get the x-forward-url
        const fwdUrl = request.headers.get(fwdUrlKey) || (queryParams[fwdUrlKey] as string | undefined);

        //check if x-forward-url is present
        if (!fwdUrl) throw { errCode: 4000, errMsg: "ooops, no forward url provided..." };
        if (!isUrl(fwdUrl)) throw { errCode: 4001, errMsg: "ooops, you gave a wrong url to forward..." };

        // get path
        const requestUrl = new URL(request.url);
        const path = requestUrl.pathname;
        //remove middleware params
        delete queryParams[fwdUrlKey];

        //add path to fwdUrl and get final url
        const stringifiedQueyParams = stringify(queryParams);
        const finalFwdUrl = urlJoin(fwdUrl, path) + (stringifiedQueyParams ? `?${stringifiedQueyParams}` : "");
        //check if post method, if yes, append body to new request
        const requestMethod = request.method.toLocaleLowerCase();
        const requestBody =
            requestMethod === "post" || requestMethod === "put" || requestMethod === "patch" ? request.body : undefined;

        //fwd whole header to new request and get the response
        const fwdResponse = await fetchResponse(finalFwdUrl, {
            headers: request.headers,
            body: requestBody,
            method: request.method.toUpperCase(),
        });
        // Make the headers mutable by re-constructing the Response.
        const mutableFwdResponse = new Response(fwdResponse.body, fwdResponse);

        //set the cors header.
        mutableFwdResponse.headers.set("Access-Control-Allow-Origin", "*");
        mutableFwdResponse.headers.set("Access-Control-Allow-Headers", "*");
        //return the whole response obtained
        return mutableFwdResponse;
    } catch (error) {
        //Error Handling for missing url or any other kind of errors.
        return new Response(JSON.stringify(error), {
            status: 400,
            headers: {
                "Content-Type": "application/json",
            },
        });
    }
}
