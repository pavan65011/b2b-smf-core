export const generateHashId = (url) => {
  const hash = crypto.createHash("sha256").update(url).digest("hex");
  const hashId = hash.toString();

  return hashId;
};
