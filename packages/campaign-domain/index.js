export const CAMPAIGN_PAGE_TYPES = ["landing", "product", "offer", "result", "confirmation"];
export const SITE_PAGE_TYPES = ["home", "landing", "product", "offer", "utility"];
export const CAMPAIGN_STATUSES = ["draft", "scheduled", "published", "expired"];

const CAMPAIGN_PAGE_TYPE_SET = new Set(CAMPAIGN_PAGE_TYPES);
const SITE_PAGE_TYPE_SET = new Set(SITE_PAGE_TYPES);
const CAMPAIGN_STATUS_SET = new Set(CAMPAIGN_STATUSES);
const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const COMPONENT_ID_PREFIX = "component";

function defined(value) {
  return value !== undefined && value !== null;
}

function isObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isNonEmptyString(value) {
  return typeof value === "string" && value.trim() !== "";
}

function isIsoDateString(value) {
  return isNonEmptyString(value) && !Number.isNaN(Date.parse(value));
}

function cloneErrors(errors) {
  return [...errors];
}

function cloneNode(node) {
  return {
    ...node,
    props: isObject(node.props) ? { ...node.props } : {},
    children: Array.isArray(node.children) ? node.children.map(cloneNode) : [],
    ...(defined(node.slot) ? { slot: node.slot } : {})
  };
}

function createComponentId() {
  if (globalThis.crypto?.randomUUID) {
    return `${COMPONENT_ID_PREFIX}-${globalThis.crypto.randomUUID()}`;
  }

  return `${COMPONENT_ID_PREFIX}-${Math.random().toString(36).slice(2, 10)}`;
}

function clampIndex(index, length) {
  if (!Number.isInteger(index)) {
    return length;
  }

  return Math.max(0, Math.min(index, length));
}

function pathStartsWith(path, prefix) {
  if (!prefix || prefix.length > path.length) {
    return false;
  }

  return prefix.every((segment, index) => path[index] === segment);
}

function adjustPathAfterRemoval(path, sourcePath) {
  const nextPath = [...path];
  const sharedLength = Math.min(path.length, sourcePath.length);

  for (let index = 0; index < sharedLength; index += 1) {
    if (path[index] === sourcePath[index]) {
      continue;
    }

    if (sourcePath[index] < path[index]) {
      nextPath[index] = path[index] - 1;
    }

    break;
  }

  return nextPath;
}

function getNodeAtPath(nodes, path) {
  let currentNodes = nodes;
  let currentNode = null;

  for (const index of path) {
    currentNode = currentNodes[index] ?? null;

    if (!currentNode) {
      return null;
    }

    currentNodes = currentNode.children;
  }

  return currentNode;
}

function removeAtPath(nodes, path) {
  const [index, ...rest] = path;

  if (!Number.isInteger(index) || index < 0 || index >= nodes.length) {
    throw new Error("Component path is invalid.");
  }

  if (rest.length === 0) {
    const nextNodes = [...nodes];
    const [removedNode] = nextNodes.splice(index, 1);

    return {
      removedNode,
      nodes: nextNodes
    };
  }

  const currentNode = nodes[index];
  const result = removeAtPath(currentNode.children, rest);
  const nextNodes = [...nodes];

  nextNodes[index] = {
    ...currentNode,
    children: result.nodes
  };

  return {
    removedNode: result.removedNode,
    nodes: nextNodes
  };
}

function insertAtPath(nodes, parentPath, node, position) {
  if (!parentPath || parentPath.length === 0) {
    const nextNodes = [...nodes];
    const nextIndex = clampIndex(position, nextNodes.length);

    nextNodes.splice(nextIndex, 0, node);
    return nextNodes;
  }

  const [index, ...rest] = parentPath;

  if (!Number.isInteger(index) || index < 0 || index >= nodes.length) {
    throw new Error("Component path is invalid.");
  }

  const currentNode = nodes[index];
  const nextNodes = [...nodes];

  if (rest.length === 0) {
    const children = [...currentNode.children];
    const nextIndex = clampIndex(position, children.length);

    children.splice(nextIndex, 0, node);
    nextNodes[index] = {
      ...currentNode,
      children
    };
    return nextNodes;
  }

  nextNodes[index] = {
    ...currentNode,
    children: insertAtPath(currentNode.children, rest, node, position)
  };

  return nextNodes;
}

function mapNodes(nodes, targetId, updater) {
  let updated = false;
  const nextNodes = nodes.map((node) => {
    if (node.id === targetId) {
      updated = true;
      return updater(node);
    }

    if (!node.children.length) {
      return node;
    }

    const result = mapNodes(node.children, targetId, updater);

    if (!result.updated) {
      return node;
    }

    updated = true;
    return {
      ...node,
      children: result.nodes
    };
  });

  return {
    updated,
    nodes: updated ? nextNodes : nodes
  };
}

function validateComponentNodeInternal(node, errors, state, label) {
  if (!isObject(node)) {
    errors.push(`${label} must be an object.`);
    return;
  }

  if (state.references.has(node)) {
    errors.push(`${label} contains a circular reference.`);
    return;
  }

  state.references.add(node);

  if (!isNonEmptyString(node.id)) {
    errors.push(`${label} must include a non-empty id.`);
  } else if (state.ids.has(node.id)) {
    errors.push(`Component "${node.id}" is duplicated.`);
  } else {
    state.ids.add(node.id);
  }

  if (!isNonEmptyString(node.primitiveType)) {
    errors.push(`${label} must include a non-empty primitiveType.`);
  }

  if (!isObject(node.props)) {
    errors.push(`${label} props must be an object.`);
  }

  if (!(node.slot === undefined || node.slot === null || isNonEmptyString(node.slot))) {
    errors.push(`${label} slot must be a non-empty string when provided.`);
  }

  if (!Array.isArray(node.children)) {
    errors.push(`${label} children must be an array.`);
    state.references.delete(node);
    return;
  }

  node.children.forEach((child, index) => {
    validateComponentNodeInternal(
      child,
      errors,
      state,
      `Component "${node.id || label}" child ${index + 1}`
    );
  });

  state.references.delete(node);
}

function validatePath(path, label, errors) {
  if (!isNonEmptyString(path)) {
    errors.push(`${label} must include a non-empty path.`);
    return;
  }

  if (!path.startsWith("/")) {
    errors.push(`${label} path must begin with "/".`);
  }
}

function validateSlug(slug, label, errors) {
  if (!isNonEmptyString(slug)) {
    errors.push(`${label} must include a non-empty slug.`);
    return;
  }

  if (!SLUG_PATTERN.test(slug)) {
    errors.push(`${label} slug must be lowercase kebab-case.`);
  }
}

/**
 * @deprecated Status is now stored in the database and transitioned by the
 * cron tick. Read `campaign.status` directly instead of calling this function.
 */
export function deriveCampaignStatus(campaign) {
  if (defined(campaign.status)) return campaign.status;
  throw new Error(
    "deriveCampaignStatus is deprecated. Read campaign.status from the database."
  );
}

export function isCampaignSlugUnique(slug, campaigns, excludeSlug) {
  const normalizedSlug = String(slug).trim().toLowerCase();
  const excluded = excludeSlug ? String(excludeSlug).trim().toLowerCase() : null;

  return !campaigns.some((campaign) => {
    const campaignSlug = String(campaign.slug).trim().toLowerCase();

    if (excluded && campaignSlug === excluded) {
      return false;
    }

    return campaignSlug === normalizedSlug;
  });
}

export function repairCampaignPageFlow(pages) {
  return pages.map((page, index) => ({
    ...page,
    next: pages[index + 1]?.id ?? null
  }));
}

export function validateCampaignPage(page) {
  const errors = [];

  if (!isObject(page)) {
    errors.push("Campaign page must be an object.");
    return { valid: false, errors };
  }

  if (!isNonEmptyString(page.id)) {
    errors.push("Campaign page must include a non-empty id.");
  }

  if (!CAMPAIGN_PAGE_TYPE_SET.has(page.type)) {
    errors.push(`Campaign page "${page.id ?? "unknown"}" uses an unsupported type.`);
  }

  if (!isNonEmptyString(page.title)) {
    errors.push(`Campaign page "${page.id ?? "unknown"}" must include a non-empty title.`);
  }

  validatePath(page.path, `Campaign page "${page.id ?? "unknown"}"`, errors);

  return { valid: errors.length === 0, errors };
}

export function validateCampaign(campaign, input = {}) {
  const errors = [];
  const { campaigns = [], excludeSlug = null } = input;

  if (!isObject(campaign)) {
    errors.push("Campaign must be an object.");
    return { valid: false, errors };
  }

  if (!isNonEmptyString(campaign.name)) {
    errors.push("Campaign must include a non-empty name.");
  }

  validateSlug(campaign.slug, "Campaign", errors);

  if (campaign.slug && campaigns.length && !isCampaignSlugUnique(campaign.slug, campaigns, excludeSlug)) {
    errors.push(`Campaign slug "${campaign.slug}" must be unique.`);
  }

  if (defined(campaign.status) && !CAMPAIGN_STATUS_SET.has(campaign.status)) {
    errors.push(`Campaign status must be one of: ${CAMPAIGN_STATUSES.join(", ")}.`);
  }

  if (defined(campaign.scheduledAt) && !isIsoDateString(campaign.scheduledAt)) {
    errors.push("Campaign scheduledAt must be a valid ISO 8601 string.");
  }

  if (defined(campaign.expiresAt) && !isIsoDateString(campaign.expiresAt)) {
    errors.push("Campaign expiresAt must be a valid ISO 8601 string.");
  }

  if (!Array.isArray(campaign.pages) || campaign.pages.length === 0) {
    errors.push("Campaign must include a non-empty pages array.");
    return { valid: false, errors };
  }

  const pageIds = new Set();
  const landingPages = campaign.pages.filter((page) => page.type === "landing");

  campaign.pages.forEach((page) => {
    const result = validateCampaignPage(page);
    errors.push(...cloneErrors(result.errors));

    if (pageIds.has(page.id)) {
      errors.push(`Campaign page "${page.id}" is duplicated.`);
    }

    pageIds.add(page.id);
  });

  if (landingPages.length < 1) {
    errors.push("Campaign must include at least one landing page.");
  }

  const entryPages = campaign.pages.filter((page) => page.isEntry);
  if (entryPages.length !== 1) {
    errors.push("Campaign must have exactly one entry page.");
  }

  return { valid: errors.length === 0, errors };
}

export function validateCampaignCollection(campaigns) {
  const errors = [];

  if (!Array.isArray(campaigns)) {
    errors.push("Campaign collection must be an array.");
    return { valid: false, errors };
  }

  campaigns.forEach((campaign) => {
    const result = validateCampaign(campaign, {
      campaigns,
      excludeSlug: campaign.slug
    });

    errors.push(...cloneErrors(result.errors).map((error) => `[${campaign.slug ?? "unknown"}] ${error}`));
  });

  return { valid: errors.length === 0, errors };
}

export function validateSitePage(page, input = {}) {
  const errors = [];
  const { campaigns = [] } = input;
  const knownCampaignSlugs = new Set(campaigns.map((campaign) => campaign.slug));

  if (!isObject(page)) {
    errors.push("Site page must be an object.");
    return { valid: false, errors };
  }

  if (!isNonEmptyString(page.id)) {
    errors.push("Site page must include a non-empty id.");
  }

  if (!SITE_PAGE_TYPE_SET.has(page.type)) {
    errors.push(`Site page "${page.id ?? "unknown"}" uses an unsupported type.`);
  }

  if (!isNonEmptyString(page.title)) {
    errors.push(`Site page "${page.id ?? "unknown"}" must include a non-empty title.`);
  }

  validatePath(page.path, `Site page "${page.id ?? "unknown"}"`, errors);

  if (!(page.campaignSlug === null || isNonEmptyString(page.campaignSlug))) {
    errors.push(`Site page "${page.id ?? "unknown"}" campaignSlug must be a string or null.`);
  }

  if (page.campaignSlug && campaigns.length && !knownCampaignSlugs.has(page.campaignSlug)) {
    errors.push(`Site page "${page.id ?? "unknown"}" references unknown campaign "${page.campaignSlug}".`);
  }

  return { valid: errors.length === 0, errors };
}

export function validateSite(site, input = {}) {
  const errors = [];
  const { campaigns = [] } = input;

  if (!isObject(site)) {
    errors.push("Site must be an object.");
    return { valid: false, errors };
  }

  if (!isNonEmptyString(site.name)) {
    errors.push("Site must include a non-empty name.");
  }

  validatePath(site.basePath, "Site", errors);

  if (!Array.isArray(site.pages) || site.pages.length === 0) {
    errors.push("Site must include a non-empty pages array.");
    return { valid: false, errors };
  }

  const pageIds = new Set();
  const homePages = site.pages.filter((page) => page.type === "home");

  site.pages.forEach((page) => {
    const result = validateSitePage(page, { campaigns });
    errors.push(...cloneErrors(result.errors));

    if (pageIds.has(page.id)) {
      errors.push(`Site page "${page.id}" is duplicated.`);
    }

    pageIds.add(page.id);
  });

  if (homePages.length !== 1) {
    errors.push("Site must include exactly one home page.");
  }

  return { valid: errors.length === 0, errors };
}

export function validateComponentNode(node) {
  const errors = [];

  validateComponentNodeInternal(node, errors, {
    ids: new Set(),
    references: new Set()
  }, "Component node");

  return { valid: errors.length === 0, errors };
}

export function validateComponentTree(nodes) {
  const errors = [];

  if (!Array.isArray(nodes)) {
    errors.push("Component tree must be an array.");
    return { valid: false, errors };
  }

  const state = {
    ids: new Set(),
    references: new Set()
  };

  nodes.forEach((node, index) => {
    validateComponentNodeInternal(node, errors, state, `Root component ${index + 1}`);
  });

  return { valid: errors.length === 0, errors };
}

export function validateCampaignPageComposition(composition) {
  const errors = [];

  if (!isObject(composition)) {
    errors.push("Campaign page composition must be an object.");
    return { valid: false, errors };
  }

  if (!isNonEmptyString(composition.pageId)) {
    errors.push("Campaign page composition must include a non-empty pageId.");
  }

  const treeResult = validateComponentTree(composition.nodes);
  errors.push(...cloneErrors(treeResult.errors));

  return { valid: errors.length === 0, errors };
}

export function createComponent(primitiveType, overrides = {}) {
  return {
    id: isNonEmptyString(overrides.id) ? overrides.id : createComponentId(),
    primitiveType,
    props: isObject(overrides.props) ? { ...overrides.props } : {},
    children: Array.isArray(overrides.children) ? overrides.children.map(cloneNode) : [],
    ...(defined(overrides.slot) ? { slot: overrides.slot } : {})
  };
}

export function findComponent(nodes, id) {
  for (const node of nodes) {
    if (node.id === id) {
      return node;
    }

    const child = findComponent(node.children, id);

    if (child) {
      return child;
    }
  }

  return null;
}

export function flattenComponents(nodes) {
  const flattened = [];

  nodes.forEach((node) => {
    flattened.push(node);
    flattened.push(...flattenComponents(node.children));
  });

  return flattened;
}

export function findComponentPath(nodes, id, currentPath = []) {
  for (const [index, node] of nodes.entries()) {
    const nextPath = [...currentPath, index];

    if (node.id === id) {
      return nextPath;
    }

    const childPath = findComponentPath(node.children, id, nextPath);

    if (childPath) {
      return childPath;
    }
  }

  return null;
}

export function getComponentTrail(nodes, id) {
  const path = findComponentPath(nodes, id);

  if (!path) {
    return [];
  }

  const trail = [];
  let currentNodes = nodes;

  for (const index of path) {
    const node = currentNodes[index];

    if (!node) {
      return [];
    }

    trail.push(node);
    currentNodes = node.children;
  }

  return trail;
}

export function addComponentToTree(nodes, parentId, node, slot) {
  const nextNode = {
    ...cloneNode(node),
    ...(defined(slot) ? { slot } : {})
  };

  if (parentId === null || parentId === undefined) {
    return [...nodes, nextNode];
  }

  const result = mapNodes(nodes, parentId, (currentNode) => ({
    ...currentNode,
    children: [...currentNode.children, nextNode]
  }));

  if (!result.updated) {
    throw new Error(`Component "${parentId}" was not found.`);
  }

  return result.nodes;
}

export function updateComponent(nodes, id, propsOrUpdater) {
  const result = mapNodes(nodes, id, (currentNode) => {
    const patch = typeof propsOrUpdater === "function"
      ? propsOrUpdater(cloneNode(currentNode))
      : propsOrUpdater;

    if (!isObject(patch)) {
      throw new Error(`Component "${id}" update must be an object.`);
    }

    return {
      ...currentNode,
      ...patch,
      props: isObject(patch.props)
        ? {
            ...currentNode.props,
            ...patch.props
          }
        : currentNode.props,
      children: Array.isArray(patch.children)
        ? patch.children.map(cloneNode)
        : currentNode.children
    };
  });

  if (!result.updated) {
    throw new Error(`Component "${id}" was not found.`);
  }

  return result.nodes;
}

export function removeComponent(nodes, id) {
  const path = findComponentPath(nodes, id);

  if (!path) {
    throw new Error(`Component "${id}" was not found.`);
  }

  return removeAtPath(nodes, path).nodes;
}

export function moveComponent(nodes, id, targetParentId, position, slot) {
  const sourcePath = findComponentPath(nodes, id);

  if (!sourcePath) {
    throw new Error(`Component "${id}" was not found.`);
  }

  const targetPath = targetParentId === null || targetParentId === undefined
    ? []
    : findComponentPath(nodes, targetParentId);

  if (targetPath === null) {
    throw new Error(`Target parent "${targetParentId}" was not found.`);
  }

  if (targetParentId !== null && targetParentId !== undefined && pathStartsWith(targetPath, sourcePath)) {
    throw new Error("A component cannot be moved into its own descendant.");
  }

  const removal = removeAtPath(nodes, sourcePath);
  const movedNode = {
    ...removal.removedNode,
    ...(defined(slot) ? { slot } : {})
  };
  const adjustedTargetPath = adjustPathAfterRemoval(targetPath, sourcePath);

  return insertAtPath(removal.nodes, adjustedTargetPath, movedNode, position);
}

export function assertValid(result, label) {
  if (!result.valid) {
    throw new Error(`${label} is invalid:\n- ${result.errors.join("\n- ")}`);
  }
}
