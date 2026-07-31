export const DOCUMENT_TYPES = ["bonafide", "transfer_certificate", "character_certificate"] as const;
export type DocumentType = (typeof DOCUMENT_TYPES)[number];

export const DOCUMENT_TYPE_LABELS: Record<DocumentType, string> = {
  bonafide: "Bonafide certificate",
  transfer_certificate: "Transfer certificate",
  character_certificate: "Character certificate",
};

export interface IssuedDocument {
  id: string;
  studentId: string;
  student: {
    id: string;
    admissionNo: string;
    user: { firstName: string; lastName: string };
    class: { name: string };
  };
  type: DocumentType;
  fileFilename: string;
  fields: { purpose?: string; reason?: string; conduct?: string; leavingDate?: string } | null;
  issuedBy: { id: string; firstName: string; lastName: string };
  issuedAt: string;
}
