import { createContext, useContext } from "react";

export interface AudienceField {
  key: string;
  label: string;
  generator?: string | null;
}

interface AudienceFieldsCtx {
  fields: AudienceField[];
  /** When true, interpolate tree with dummy values before rendering in the editor */
  previewMode: boolean;
  setPreviewMode: (v: boolean) => void;
}

export const AudienceFieldsContext = createContext<AudienceFieldsCtx>({
  fields: [],
  previewMode: false,
  setPreviewMode: () => {},
});

export function useAudienceFields() {
  return useContext(AudienceFieldsContext);
}

/** Built-in context tokens always available regardless of audience fields */
export const BUILT_IN_TOKENS: { token: string; label: string; example: string }[] = [
  { token: "{{context.city}}",    label: "Visitor city",    example: "New York" },
  { token: "{{context.country}}", label: "Visitor country", example: "US" },
  { token: "{{context.device}}",  label: "Visitor device",  example: "desktop" },
  { token: "{{url.ref}}",         label: "URL ?ref=",       example: "homepage" },
  { token: "{{url.coupon}}",      label: "URL ?coupon=",    example: "WELCOME20" },
  { token: "{{form.email}}",      label: "Form email",      example: "jane@example.com" },
];
