import crypto from "crypto";

export default function handler(req,res){
  if(req.method !== "GET") return res.status(405).json({message:"Method not allowed"});
  const privateKey=process.env.IMAGEKIT_PRIVATE_KEY;
  if(!privateKey) return res.status(500).json({message:"IMAGEKIT_PRIVATE_KEY no está configurada en Vercel"});
  const token=crypto.randomBytes(16).toString("hex");
  const expire=Math.floor(Date.now()/1000)+1800;
  const signature=crypto.createHmac("sha1",privateKey).update(token+expire).digest("hex");
  return res.status(200).json({token,expire,signature});
}
