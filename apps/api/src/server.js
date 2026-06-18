import http from "node:http";

import {
  checkCampaignSlugAvailable,
  createCampaign,
  deleteCampaign,
  getCampaignBySlug,
  listCampaigns,
  updateCampaign
} from "./repositories/campaigns.js";
import {
  getPageComposition,
  listCampaignCompositions,
  savePageComposition
} from "./repositories/compositions.js";
import { getDatabase } from "./db.js";
import {
  assignSitePageCampaign,
  createSitePage,
  deleteSitePage,
  fetchSite,
  updateSitePage
} from "./repositories/site.js";
import {
  readJsonBody,
  sendJson,
  sendNoContent,
  sendNotFound,
  sendRequestError,
  sendServerError
} from "./utils/http.js";

const PORT = 3001;

function stripApiPrefix(pathname) {
  return pathname.replace(/^\/api/, "") || "/";
}

async function handleRequest(request, response) {
  const url = new URL(request.url, `http://${request.headers.host || "localhost"}`);
  const pathname = stripApiPrefix(url.pathname);

  if (request.method === "OPTIONS") {
    sendJson(response, 200, { ok: true });
    return;
  }

  if (request.method === "GET" && pathname === "/campaigns") {
    try {
      const campaigns = listCampaigns(getDatabase());
      sendJson(response, 200, campaigns);
      return;
    } catch (error) {
      sendServerError(response, error);
      return;
    }
  }

  if (request.method === "GET" && pathname === "/campaigns/slug-available") {
    try {
      const slug = url.searchParams.get("slug") ?? "";
      const excludeSlug = url.searchParams.get("excludeSlug");
      const available = checkCampaignSlugAvailable(getDatabase(), slug, excludeSlug);

      sendJson(response, 200, { available });
      return;
    } catch (error) {
      sendServerError(response, error);
      return;
    }
  }

  if (request.method === "GET" && pathname.startsWith("/campaigns/") && pathname.endsWith("/compositions")) {
    try {
      const slug = decodeURIComponent(pathname.slice("/campaigns/".length, -"/compositions".length));
      const compositions = listCampaignCompositions(getDatabase(), slug);

      sendJson(response, 200, compositions);
      return;
    } catch (error) {
      sendRequestError(response, error);
      return;
    }
  }

  if (request.method === "GET" && pathname.startsWith("/campaigns/")) {
    try {
      const slug = decodeURIComponent(pathname.slice("/campaigns/".length));
      const campaign = getCampaignBySlug(getDatabase(), slug);

      if (!campaign) {
        sendNotFound(response, `Campaign "${slug}" was not found.`);
        return;
      }

      sendJson(response, 200, campaign);
      return;
    } catch (error) {
      sendServerError(response, error);
      return;
    }
  }

  if (request.method === "GET" && pathname.startsWith("/campaign-pages/") && pathname.endsWith("/composition")) {
    try {
      const pageId = decodeURIComponent(pathname.slice("/campaign-pages/".length, -"/composition".length));
      const composition = getPageComposition(getDatabase(), pageId);

      sendJson(response, 200, composition);
      return;
    } catch (error) {
      sendRequestError(response, error);
      return;
    }
  }

  if (request.method === "POST" && pathname === "/campaigns") {
    try {
      const body = await readJsonBody(request);
      const campaign = createCampaign(getDatabase(), body);

      sendJson(response, 201, campaign);
      return;
    } catch (error) {
      sendRequestError(response, error);
      return;
    }
  }

  if (request.method === "PUT" && pathname.startsWith("/campaigns/")) {
    try {
      const slug = decodeURIComponent(pathname.slice("/campaigns/".length));
      const body = await readJsonBody(request);
      const campaign = updateCampaign(getDatabase(), slug, body);

      sendJson(response, 200, campaign);
      return;
    } catch (error) {
      sendRequestError(response, error);
      return;
    }
  }

  if (request.method === "DELETE" && pathname.startsWith("/campaigns/")) {
    try {
      const slug = decodeURIComponent(pathname.slice("/campaigns/".length));
      deleteCampaign(getDatabase(), slug);
      sendNoContent(response, 204);
      return;
    } catch (error) {
      sendRequestError(response, error);
      return;
    }
  }

  if (request.method === "PUT" && pathname.startsWith("/campaign-pages/") && pathname.endsWith("/composition")) {
    try {
      const pageId = decodeURIComponent(pathname.slice("/campaign-pages/".length, -"/composition".length));
      const body = await readJsonBody(request);
      const composition = savePageComposition(getDatabase(), pageId, body.nodes);

      sendJson(response, 200, composition);
      return;
    } catch (error) {
      sendRequestError(response, error);
      return;
    }
  }

  if (request.method === "GET" && pathname === "/site") {
    try {
      const site = fetchSite(getDatabase());
      sendJson(response, 200, site);
      return;
    } catch (error) {
      sendRequestError(response, error);
      return;
    }
  }

  if (request.method === "POST" && pathname === "/site/pages") {
    try {
      const body = await readJsonBody(request);
      const page = createSitePage(getDatabase(), body);
      sendJson(response, 201, page);
      return;
    } catch (error) {
      sendRequestError(response, error);
      return;
    }
  }

  if (request.method === "PATCH" && pathname.startsWith("/site/pages/") && pathname.endsWith("/campaign")) {
    try {
      const pageId = decodeURIComponent(pathname.slice("/site/pages/".length, -"/campaign".length));
      const body = await readJsonBody(request);
      const page = assignSitePageCampaign(
        getDatabase(),
        pageId,
        body.campaignSlug ?? null
      );
      sendJson(response, 200, page);
      return;
    } catch (error) {
      sendRequestError(response, error);
      return;
    }
  }

  if (request.method === "PUT" && pathname.startsWith("/site/pages/")) {
    try {
      const pageId = decodeURIComponent(pathname.slice("/site/pages/".length));
      const body = await readJsonBody(request);
      const page = updateSitePage(getDatabase(), pageId, body);
      sendJson(response, 200, page);
      return;
    } catch (error) {
      sendRequestError(response, error);
      return;
    }
  }

  if (request.method === "DELETE" && pathname.startsWith("/site/pages/")) {
    try {
      const pageId = decodeURIComponent(pathname.slice("/site/pages/".length));
      deleteSitePage(getDatabase(), pageId);
      sendNoContent(response, 204);
      return;
    } catch (error) {
      sendRequestError(response, error);
      return;
    }
  }

  sendNotFound(response, "Endpoint not found.");
}

const server = http.createServer(handleRequest);

server.listen(PORT, () => {
  console.log(`Primitive API listening on http://localhost:${PORT}`);
});
