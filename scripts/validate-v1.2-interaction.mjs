import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const fail=(msg)=>{console.error(`INTERACTION_V1_2=FAIL ${msg}`);process.exit(1);};
const read=(rel)=>fs.readFileSync(path.join(root,rel),'utf8');
const exists=(rel)=>fs.existsSync(path.join(root,rel));
const required=[
  'src/camera/MapCameraEngine.js','src/map/SemanticZoomEngine.js','src/map/SpatialIndex.js','src/map/LabelManager.js','src/map/ClusterManager.js','src/map/VisualPriorityManager.js',
  'src/interaction/SelectionContext.js','src/interaction/FocusModeEngine.js',
  'src/traffic/TrafficPlanner.js','src/traffic/VehicleSpawner.js','src/traffic/VehicleMovement.js','src/traffic/DeliveryResolver.js','src/traffic/TrafficLogisticsEngine.js'
];
for(const f of required)if(!exists(f))fail(`missing=${f}`);

const routes=JSON.parse(read('src/data/routes-v1.json')).routes||[];
const nodes=JSON.parse(read('src/data/infrastructure-v1.json')).nodes||[];
const byId=new Map(routes.map(r=>[r.id,r]));
const alt=byId.get('sea-mrs-cape-singapore');
if(!alt)fail('missing-suez-reroute');
if((alt.waypoints||[]).length<6)fail('alternate-route-waypoints');
if(!routes.every(r=>['OPEN','CONGESTED','RESTRICTED','RISKY','BLOCKED','CLOSED'].includes(String(r.status||'OPEN').toUpperCase())))fail('invalid-route-status');
if(!routes.every(r=>(r.waypoints||[]).every(p=>Number.isFinite(Number(p.lat))&&Number.isFinite(Number(p.lon)))))fail('invalid-waypoint');

const layer=read('src/game/infrastructure/LayerManagerV1.js');
for(const preset of ['ECONOMY','LOGISTICS','ENERGY','MILITARY','DIGITAL','INTELLIGENCE','CRISIS','TRAFFIC','ALL'])if(!layer.includes(`${preset}:`))fail(`preset=${preset}`);
for(const type of ['SHIP','PLANE','TRAIN','TRUCK'])if(!read('src/traffic/VehicleSpawner.js').includes(type))fail(`vehicle=${type}`);

const camera=read('src/camera/MapCameraEngine.js');
for(const op of ['zoomAt','panPixels','beginDrag','dragTo','endDrag','fitBounds','reset','focus','setFollowTarget','viewport'])if(!camera.includes(`${op}(`))fail(`camera-op=${op}`);
const worldView=read('src/views/WorldView.js');
for(const evt of ['wheel','pointerdown','pointermove','pointerup','dblclick'])if(!worldView.includes(evt))fail(`interaction=${evt}`);
const html=read('index.html');
for(const ctl of ['zoom-in','zoom-out','fit','focus','follow','reset'])if(!html.includes(`data-wi-map="${ctl}"`))fail(`map-control=${ctl}`);

const delivery=read('src/traffic/DeliveryResolver.js');
if(!delivery.includes("mode='MIRROR'"))fail('delivery-accounting-contract');

console.log(`INTERACTION_V1_2=OK nodes=${nodes.length} routes=${routes.length} mapCamera=1 semanticZoom=1 spatialIndex=1 labels=1 clusters=1 traffic=SHIP,PLANE,TRAIN,TRUCK reroute=CAP deliveryAccounting=MIRROR`);
