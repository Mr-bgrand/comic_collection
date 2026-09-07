import {mountPhotoIntake} from './photo-intake.mjs';
const host=document.getElementById('phone-intake');
try {
  let token=location.hash.slice(1)||sessionStorage.getItem('collection-photo-pairing');
  if(!/^[A-Za-z0-9_-]{32}$/.test(token||''))throw Error('Open Admin → Photos on your computer and scan the camera QR code.');
  sessionStorage.setItem('collection-photo-pairing',token);history.replaceState(null,'',location.pathname);
  const response=await fetch('/api/capture/session',{headers:{Authorization:'Bearer '+token},cache:'no-store'}),result=await response.json();
  if(!response.ok)throw Error(result.error);
  host.innerHTML=await (await fetch('/capture/photo-intake.html')).text();
  const intake=mountPhotoIntake(host,{base:'/api/capture',token,phone:true});await intake.select(result.record.id);
}catch(error){host.replaceChildren();const p=document.createElement('p');p.className='photo-status error';p.textContent=error.message;host.append(p);}
