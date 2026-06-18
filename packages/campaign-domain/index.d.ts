export type CampaignPageType = "landing" | "product" | "offer";
export type SitePageType = "home" | "landing" | "product" | "offer" | "utility";
export type CampaignStatus = "active" | "scheduled" | "expired";

export interface CampaignPage {
  id: string;
  type: CampaignPageType;
  title: string;
  path: string;
  next: string | null;
}

export interface ComponentNode {
  id: string;
  primitiveType: string;
  props: Record<string, unknown>;
  children: ComponentNode[];
  slot?: string;
}

export interface CampaignPageComposition {
  pageId: string;
  nodes: ComponentNode[];
}

export interface Campaign {
  slug: string;
  name: string;
  startDate: string;
  endDate: string;
  pages: CampaignPage[];
}

export interface SitePage {
  id: string;
  title: string;
  path: string;
  type: SitePageType;
  campaignSlug: string | null;
}

export interface Site {
  name: string;
  basePath: string;
  pages: SitePage[];
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

export declare const CAMPAIGN_PAGE_TYPES: CampaignPageType[];
export declare const SITE_PAGE_TYPES: SitePageType[];
export declare const CAMPAIGN_STATUSES: CampaignStatus[];

export declare function deriveCampaignStatus(campaign: Campaign, now?: number): CampaignStatus;
export declare function isCampaignSlugUnique(
  slug: string,
  campaigns: Campaign[],
  excludeSlug?: string | null
): boolean;
export declare function repairCampaignPageFlow(pages: CampaignPage[]): CampaignPage[];
export declare function validateCampaignPage(page: CampaignPage): ValidationResult;
export declare function validateCampaign(
  campaign: Campaign,
  input?: {
    campaigns?: Campaign[];
    excludeSlug?: string | null;
  }
): ValidationResult;
export declare function validateCampaignCollection(campaigns: Campaign[]): ValidationResult;
export declare function validateComponentNode(node: ComponentNode): ValidationResult;
export declare function validateComponentTree(nodes: ComponentNode[]): ValidationResult;
export declare function validateCampaignPageComposition(
  composition: CampaignPageComposition
): ValidationResult;
export declare function validateSitePage(
  page: SitePage,
  input?: {
    campaigns?: Campaign[];
  }
): ValidationResult;
export declare function validateSite(
  site: Site,
  input?: {
    campaigns?: Campaign[];
  }
): ValidationResult;
export declare function createComponent(
  primitiveType: string,
  overrides?: Partial<ComponentNode>
): ComponentNode;
export declare function findComponent(nodes: ComponentNode[], id: string): ComponentNode | null;
export declare function flattenComponents(nodes: ComponentNode[]): ComponentNode[];
export declare function getComponentTrail(nodes: ComponentNode[], id: string): ComponentNode[];
export declare function findComponentPath(nodes: ComponentNode[], id: string): number[] | null;
export declare function addComponentToTree(
  nodes: ComponentNode[],
  parentId: string | null,
  node: ComponentNode,
  slot?: string
): ComponentNode[];
export declare function updateComponent(
  nodes: ComponentNode[],
  id: string,
  propsOrUpdater:
    | Partial<ComponentNode>
    | ((node: ComponentNode) => Partial<ComponentNode> | ComponentNode)
): ComponentNode[];
export declare function removeComponent(nodes: ComponentNode[], id: string): ComponentNode[];
export declare function moveComponent(
  nodes: ComponentNode[],
  id: string,
  targetParentId: string | null,
  position?: number,
  slot?: string
): ComponentNode[];
export declare function assertValid(result: ValidationResult, label: string): void;
