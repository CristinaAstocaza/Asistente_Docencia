import { Injectable } from '@nestjs/common';
import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { mkdir, readFile, writeFile, unlink } from 'node:fs/promises';
import { resolve } from 'node:path';
import { CloudinaryStorage } from './cloudinary';
import { Database } from '../database/database';
@Injectable()
export class Storage {
 private readonly cloudinary=new CloudinaryStorage();
 private readonly driver=process.env.STORAGE_DRIVER||'local';
 constructor(private readonly db?:Database){if(!['local','s3','cloudinary'].includes(this.driver))throw new Error('Invalid storage driver');}
 private async location(key:string){this.path(key);if(!this.db)return this.driver;const [file]=await this.db.query('SELECT driver FROM stored_files WHERE storage_key=$1',[key]);return file?.driver||this.driver;}
 private readonly root = resolve(process.env.STORAGE_PATH || './storage');
 private readonly bucket = process.env.S3_BUCKET || 'docente';
 private readonly s3 = process.env.STORAGE_DRIVER === 's3'||(process.env.S3_ACCESS_KEY&&process.env.S3_SECRET_KEY) ? new S3Client({
  endpoint:process.env.S3_ENDPOINT,region:process.env.S3_REGION || 'us-east-1',forcePathStyle:true,
  credentials:{accessKeyId:process.env.S3_ACCESS_KEY || '',secretAccessKey:process.env.S3_SECRET_KEY || ''},
 }) : null;
 private path(key:string) { if (!/^[a-f0-9-]{36}$/.test(key)) throw new Error('Invalid storage key'); return resolve(this.root,key); }
 async put(key:string,data:Buffer,mime:string) {
  this.path(key);
  if(this.driver==='cloudinary')await this.cloudinary.put(key,data,mime);
  else if (this.driver==='s3') await this.s3!.send(new PutObjectCommand({Bucket:this.bucket,Key:key,Body:data,ContentType:mime}));
  else { await mkdir(this.root,{recursive:true}); await writeFile(this.path(key),data,{flag:'wx'}); }
  if(this.db)try{await this.db.query('INSERT INTO stored_files(storage_key,driver) VALUES($1,$2)',[key,this.driver]);}catch(e){if(this.driver==='cloudinary')await this.cloudinary.delete(key);else if(this.driver==='s3')await this.s3!.send(new DeleteObjectCommand({Bucket:this.bucket,Key:key}));else await unlink(this.path(key));throw e;}
 }
 async get(key:string) {
  const driver=await this.location(key);
  if(driver==='cloudinary')return this.cloudinary.get(key);
  if (driver==='local') return readFile(this.path(key));
  if(!this.s3)throw new Error('Configure S3 for legacy files');
  const result = await this.s3.send(new GetObjectCommand({Bucket:this.bucket,Key:key}));
  return Buffer.from(await result.Body!.transformToByteArray());
 }
 async delete(key:string) {
  const driver=await this.location(key);
  if(driver==='cloudinary')await this.cloudinary.delete(key);
  else if(driver==='s3'){if(!this.s3)throw new Error('Configure S3 for legacy files');await this.s3.send(new DeleteObjectCommand({Bucket:this.bucket,Key:key}));}
  else await unlink(this.path(key)).catch((e:NodeJS.ErrnoException)=>{if(e.code!=='ENOENT') throw e;});
  if(this.db)await this.db.query('DELETE FROM stored_files WHERE storage_key=$1',[key]);
 }
}
