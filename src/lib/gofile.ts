const GOFILE_TOKEN = process.env.GOFILE_TOKEN!;
const UPLOAD_URL = "https://upload.gofile.io/uploadfile";
const API_URL = "https://api.gofile.io";

export async function uploadToGofile(file: File, folderId?: string) {
  if (!GOFILE_TOKEN) throw new Error("GOFILE_TOKEN missing");
  const form = new FormData();
  form.append("file", file);
  if (folderId) form.append("folderId", folderId);

  const res = await fetch(UPLOAD_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${GOFILE_TOKEN}` },
    body: form,
  });
  const json = await res.json();
  if (json.status !== "ok") throw new Error(`gofile upload failed: ${json.status}`);
  return json.data as {
    id: string;
    name: string;
    parentFolder: string;
    downloadPage: string;
    code: string;
    size: number;
    mimetype: string;
  };
}

export async function getAccountId() {
  const res = await fetch(`${API_URL}/accounts/getid`, {
    headers: { Authorization: `Bearer ${GOFILE_TOKEN}` },
  });
  const json = await res.json();
  if (json.status !== "ok") throw new Error(json.status);
  return json.data.id as string;
}

export async function getRootFolder(): Promise<string> {
  const accountId = await getAccountId();
  const res = await fetch(`${API_URL}/accounts/${accountId}`, {
    headers: { Authorization: `Bearer ${GOFILE_TOKEN}` },
  });
  const json = await res.json();
  if (json.status !== "ok") throw new Error(json.status);
  return json.data.rootFolder as string;
}

export async function createFolder(parentFolderId: string, folderName: string) {
  const res = await fetch(`${API_URL}/contents/createFolder`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${GOFILE_TOKEN}`,
    },
    body: JSON.stringify({ parentFolderId, folderName }),
  });
  const json = await res.json();
  if (json.status !== "ok") throw new Error(`createFolder: ${json.status}`);
  return json.data as { id: string; code: string; name: string };
}
