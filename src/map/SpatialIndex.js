const intersects=(a,b)=>!(b.minLon>a.maxLon||b.maxLon<a.minLon||b.minLat>a.maxLat||b.maxLat<a.minLat);
const contains=(b,p)=>p.lon>=b.minLon&&p.lon<=b.maxLon&&p.lat>=b.minLat&&p.lat<=b.maxLat;

class QuadNode {
  constructor(bounds,depth=0,maxDepth=7,capacity=12){this.bounds=bounds;this.depth=depth;this.maxDepth=maxDepth;this.capacity=capacity;this.items=[];this.children=null;}
  subdivide(){const b=this.bounds,mx=(b.minLon+b.maxLon)/2,my=(b.minLat+b.maxLat)/2;this.children=[
    new QuadNode({minLon:b.minLon,minLat:my,maxLon:mx,maxLat:b.maxLat},this.depth+1,this.maxDepth,this.capacity),
    new QuadNode({minLon:mx,minLat:my,maxLon:b.maxLon,maxLat:b.maxLat},this.depth+1,this.maxDepth,this.capacity),
    new QuadNode({minLon:b.minLon,minLat:b.minLat,maxLon:mx,maxLat:my},this.depth+1,this.maxDepth,this.capacity),
    new QuadNode({minLon:mx,minLat:b.minLat,maxLon:b.maxLon,maxLat:my},this.depth+1,this.maxDepth,this.capacity)
  ];}
  insert(item){if(!contains(this.bounds,item.position))return false;if(this.items.length<this.capacity||this.depth>=this.maxDepth){this.items.push(item);return true;}if(!this.children)this.subdivide();for(const child of this.children)if(child.insert(item))return true;this.items.push(item);return true;}
  query(range,out){if(!intersects(this.bounds,range))return out;for(const item of this.items)if(contains(range,item.position))out.push(item);for(const child of this.children||[])child.query(range,out);return out;}
}

export class SpatialIndex {
  constructor({bounds={minLon:-180,minLat:-90,maxLon:180,maxLat:90},capacity=12,maxDepth=7}={}){this.bounds=bounds;this.capacity=capacity;this.maxDepth=maxDepth;this.root=new QuadNode(bounds,0,maxDepth,capacity);this.count=0;}
  clear(){this.root=new QuadNode(this.bounds,0,this.maxDepth,this.capacity);this.count=0;}
  rebuild(items=[]){this.clear();for(const item of items)this.insert(item);return this;}
  insert(item){if(!item?.position)return false;const ok=this.root.insert(item);if(ok)this.count++;return ok;}
  query(bounds){if(!bounds)return[];if(bounds.wraps||bounds.minLon>bounds.maxLon){return [...this.root.query({minLon:bounds.minLon,minLat:bounds.minLat,maxLon:180,maxLat:bounds.maxLat},[]),...this.root.query({minLon:-180,minLat:bounds.minLat,maxLon:bounds.maxLon,maxLat:bounds.maxLat},[])];}return this.root.query(bounds,[]);}
}
