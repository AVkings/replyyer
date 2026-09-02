/**
 * GoFile.io client — file storage for chat attachments
 * Docs: https://gofile.io/api
 * Files are organized under a parent folder named `repllyer`.
 */

const GOFILE_API_BASE = "https://api.gofile.io";

type GoFileUploadResult = {
  downloadPage: string;
  directLink?: string;
  fileId: string;
  fileName: string;
};

async function getOrCreateRepllyerFolder(token: string): Promise<string | null> {
  // If GOFILE_FOLDER_ID is set, reuse it
  if (process.env.GOFILE_FOLDER_ID) return process.env.GOFILE_FOLDER_ID;

  // Try to create a folder named `repllyer` at root.
  // GoFile requires an account's root folder — we fetch it first.
  try {
    const accountRes = await fetch(`${GOFILE_API_BASE}/getAccountDetails?token=${token}`, {
      method: "GET",
    });
    const accountJson = (await accountRes.json()) as {
      status: string;
      data: { rootFolder: string };
    };

    if (accountJson.status !== "ok" || !accountJson.data?.rootFolder) {
      console.warn("[GoFile] Could not fetch rootFolder, uploading to root");
      return null;
    }

    const rootFolderId = accountJson.data.rootFolder;

    // Create subfolder `repllyer` under root
    const createForm = new FormData();
    createForm.append("token", token);
    createForm.append("parentFolderId", rootFolderId);
    createForm.append("folderName", "repllyer");

    const createRes = await fetch(`${GOFILE_API_BASE}/createFolder`, {
      method: "POST",
      body: createForm,
    });

    const createJson = (await createRes.json()) as {
      status: string;
      data: { id: string };
    };

    // If folder already exists, API may return error — fall back to root
    if (createJson.status === "ok" && createJson.data?.id) {
      return createJson.data.id;
    }

    // Try to list root folder contents to find existing `repllyer` folder
    const listRes = await fetch(
      `${GOFILE_API_BASE}/getFolder?folderId=${rootFolderId}&token=${token}`
    );
    const listJson = (await listRes.json()) as {
      status: string;
      data: { childs: Array<{ id: string; name: string; type: string }> };
    };
    const existing = listJson.data?.childs?.find(
      (c) => c.type === "folder" && c.name === "repllyer"
    );
    if (existing) return existing.id;

    return rootFolderId; // fallback: upload to root
  } catch (err) {
    console.warn("[GoFile] getOrCreateRepllyerFolder failed", err);
    return null;
  }
}

export async function uploadToGoFile(
  file: File | Blob,
  fileName: string
): Promise<GoFileUploadResult> {
  const token = process.env.GOFILE_API_TOKEN;
  if (!token) throw new Error("Missing env var GOFILE_API_TOKEN");

  const folderId = await getOrCreateRepllyerFolder(token);

  // GoFile upload endpoint: https://upload.gofile.io/uploadFile
  // Spec: POST multipart/form-data with `file` + `token` + `folderId` (+ optional `server`)
  const serversRes = await fetch(`${GOFILE_API_BASE}/getServers`);
  const serversJson = (await serversRes.json()) as {
    status: string;
    data: { servers: Array<{ name: string }> };
  };
  const server =
    serversJson.status === "ok" ? serversJson.data.servers[0]?.name : "store1";

  const form = new FormData();
  // GoFile expects field name `file`
  form.append("file", file, fileName);
  form.append("token", token);
  if (folderId) form.append("folderId", folderId);

  const uploadUrl = `https://${server}.gofile.io/uploadFile`;

  const res = await fetch(uploadUrl, {
    method: "POST",
    body: form,
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`GoFile upload failed (${res.status}): ${text}`);
  }

  const json = (await res.json()) as {
    status: string;
    data: {
      fileId: string;
      fileName: string;
      downloadPage: string;
      directLink?: string;
      directLinkExpire?: string;
    };
  };

  if (json.status !== "ok" || !json.data) {
    throw new Error(`GoFile upload error: ${JSON.stringify(json)}`);
  }

  return {
    fileId: json.data.fileId,
    fileName: json.data.fileName,
    downloadPage: json.data.downloadPage,
    directLink: json.data.directLink,
  };
}
