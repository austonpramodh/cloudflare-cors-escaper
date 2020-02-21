import urlJoin from "url-join";
import { parseUrl } from "query-string";
import isUrl from "is-url";
const fwdUrlKey = "x-forward-url";

const fetchResponse = async (url: string, { headers, method, body }: RequestInit): Promise<Response> => {
    return fetch(url, { method, headers, body });
};

export async function handleRequest(request: Request): Promise<Response> {
    try {
        //get the x-forward-url
        const fwdUrl = request.headers.get(fwdUrlKey) || (parseUrl(request.url).query[fwdUrlKey] as string);
        //check if x-forward-url is present, if not throw error
        if (fwdUrl === undefined)
            throw { errCode: 4001, errMsg: "ooops, you forgot to use x-forward-url for forwarding the request..." };

        //check if x-forward-url is valid, if not throw error
        if (!isUrl(fwdUrl)) throw { errCode: 4002, errMsg: "ooops, you gave a wrong url to forward..." };

        //parse params
        //checking if undefined helps in avoiding addtion of undefined key in params of newly forming url
        const params = request.url.split("?")[1] === undefined ? "" : request.url.split("?")[1];

        // get path
        const path = new URL(request.url).pathname;

        //add path to fwdUrl and get final url
        const finalFwdUrl = urlJoin(fwdUrl, path) + `?${params}`;

        //check if post method, if yes, append body to new request
        const requestBody = request.method.toLocaleLowerCase() === "post" ? await request.text() : undefined;

        //fwd whole header to new request
        const fwdResponse = await fetchResponse(finalFwdUrl, {
            headers: request.headers,
            body: requestBody,
            method: request.method.toUpperCase(),
        });

        //Body obtained from the proxied request
        const fwdBody = await fwdResponse.text();

        return new Response(fwdBody, {
            status: 200,
            headers: fwdResponse.headers,
        });
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
