/**
 * Allison — the Sirenian from Edith Mina Lyre's Agamemnon.
 * Revised procedural model, 3 October 2026: quiet features, soft flowing hair.
 *
 * Drop-in replacement for modules/allison.js in the Elysicester game.
 * Keeps ALLISON_SAYS, bioFrom and the createAllison return contract.
 * One mesh, one material, no image textures or new dependencies.
 * Coordinates: Y up, feet at 0, forward +Z, height 1.36 game units.
 *
 * Character, story and original design © Edith Mina Lyre.
 * This enhancement was made with Codex; it is a new interpretation of that design.
 */
import {
    BufferGeometry, Color, DoubleSide, Float32BufferAttribute,
    Mesh, MeshToonMaterial, SphereGeometry, Vector3, CatmullRomCurve3,
} from 'three';

export const ALLISON_SAYS = 'I’ve been trying to read this old plaque. It’s all Latin. What could it mean?';
export const ALLISON_DESIGN = Object.freeze({
    height: 1.36, forward: '+Z', up: '+Y', neck: 1.15 * 1.36 / 1.5,
    source: 'https://edithminalyre.com/read',
    detail: ['high', 'mobile'],
    materialKinds: ['skin', 'hair', 'shirt', 'trousers', 'apron', 'silver', 'eyes', 'mouth', 'badge'],
    palette: { skin: 0xcfe3ee, hair: 0xe9bb62, eyes: 0x9559e8, wheat: 0xe8c46a, magenta: 0xb02860 },
});
const SCALE = 1.36 / 1.5;
const SKIN = 0, HAIR = 1, SHIRT = 2, PANTS = 3, APRON = 4, SILVER = 5, EYES = 6, INK = 7, BADGE = 8;
const C = {
    skin: 0xffffff, gill: 0xd2e2e9, lip: 0xb7a4b6, hair: 0xe9bb62,
    shirt: 0xf2eee3, fold: 0xdddcd4, pants: 0x28354c, cuff: 0x3d4c65,
    apron: 0x643047, stitch: 0xb88288, silver: 0xbfcfd7, pearl: 0xe5e8e7,
    iris: 0x9861e9, pupil: 0x35265b, ink: 0x514266, gold: 0xc6a452,
};
const vec = (p) => new Vector3(...p);
const smooth = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const gauss = (x, center, spread) => Math.exp(-(((x - center) / spread) ** 2));

/** Smooth cardinal interpolation between measured cross sections. */
function profile(rows, y, column) {
    let i = 0;
    while (i < rows.length - 2 && rows[i + 1][0] < y) i++;
    const a = rows[i], b = rows[Math.min(i + 1, rows.length - 1)];
    const t = Math.max(0, Math.min(1, (y - a[0]) / Math.max(1e-8, b[0] - a[0])));
    const p0 = rows[Math.max(0, i - 1)][column], p1 = a[column];
    const p2 = b[column], p3 = rows[Math.min(rows.length - 1, i + 2)][column];
    return 0.5 * ((2 * p1) + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t * t + (-p0 + 3 * p1 - 3 * p2 + p3) * t * t * t);
}

function surface(nu, nv, fn, wrap = false) {
    const pos = [], indices = [];
    for (let j = 0; j <= nv; j++) for (let i = 0; i <= nu; i++) pos.push(...fn(i / nu, j / nv));
    for (let j = 0; j < nv; j++) for (let i = 0; i < nu; i++) {
        const a = j * (nu + 1) + i, b = a + nu + 1;
        indices.push(a, a + 1, b, b, a + 1, b + 1);
    }
    const g = new BufferGeometry();
    g.setAttribute('position', new Float32BufferAttribute(pos, 3)); g.setIndex(indices); g.computeVertexNormals();
    if (wrap) {
        const ns = g.attributes.normal;
        for (let j = 0; j <= nv; j++) {
            const a = j * (nu + 1), b = a + nu;
            const n = new Vector3(ns.getX(a) + ns.getX(b), ns.getY(a) + ns.getY(b), ns.getZ(a) + ns.getZ(b)).normalize();
            ns.setXYZ(a, n.x, n.y, n.z); ns.setXYZ(b, n.x, n.y, n.z);
        }
    }
    return g;
}

function outward(g){
    const a=g.index.array;for(let i=0;i<a.length;i+=3){const t=a[i+1];a[i+1]=a[i+2];a[i+2]=t;}
    g.computeVertexNormals();return g;
}

/** Close the two ends of a ring-based surface, including hidden clothing joints. */
function closeRings(g,radial,vertical){
    const positions=Array.from(g.attributes.position.array),indices=Array.from(g.index.array);
    for(const row of [0,vertical]){
        const center=[0,0,0],base=row*(radial+1);
        for(let i=0;i<radial;i++)for(let axis=0;axis<3;axis++)center[axis]+=positions[(base+i)*3+axis]/radial;
        const ci=positions.length/3;positions.push(...center);
        for(let i=0;i<radial;i++)if(row===0)indices.push(ci,base+i+1,base+i);else indices.push(ci,base+i,base+i+1);
    }
    g.setAttribute('position',new Float32BufferAttribute(positions,3));g.setIndex(indices);g.computeVertexNormals();return g;
}

/** Rounded anatomical/cloth loft. Rows: [y, half-width, half-depth, center-z, center-x]. */
function loft(rows, radial, vertical, deform) {
    const y0 = rows[0][0], y1 = rows.at(-1)[0];
    return closeRings(surface(radial, vertical, (u, v) => {
        const y = y0 + (y1 - y0) * v, theta = u * Math.PI * 2;
        const rx = Math.max(0.0001, profile(rows, y, 1)), rz = Math.max(0.0001, profile(rows, y, 2));
        const zc = profile(rows, y, 3), xc = profile(rows, y, 4);
        const p = [xc + rx * Math.sin(theta), y, zc + rz * Math.cos(theta)];
        return deform ? deform(p, theta, v) : p;
    }, true),radial,vertical);
}

/** Parallel-transport sweep: an elliptical lock, tendon, fold or tiny seam. */
function sweep(points, width, depth, along, around, radiusFn = (t) => 1, flute = 0) {
    const curve = new CatmullRomCurve3(points.map(vec), false, 'centripetal');
    const centers = [], us = [], vs = [];
    let previous;
    for (let i = 0; i <= along; i++) {
        const t = i / along, p = curve.getPoint(t), tangent = curve.getTangent(t).normalize();
        let u;
        if (previous) u = previous.clone().addScaledVector(tangent, -previous.dot(tangent)).normalize();
        else u = new Vector3().crossVectors(Math.abs(tangent.y) < .9 ? new Vector3(0, 1, 0) : new Vector3(1, 0, 0), tangent).normalize();
        const v = new Vector3().crossVectors(tangent, u).normalize();
        previous = u; centers.push(p); us.push(u); vs.push(v);
    }
    return closeRings(surface(around, along, (u, v) => {
        const i = Math.round(v * along), a = u * Math.PI * 2;
        const radius = Math.max(.035, radiusFn(v)) * (1 + flute * Math.cos(a * 5));
        const p = centers[i].clone().addScaledVector(us[i], Math.cos(a) * width * radius).addScaledVector(vs[i], Math.sin(a) * depth * radius);
        return [p.x, p.y, p.z];
    }, true),around,along);
}

/** The same geometry is used by the game, preview and GLB export. */
export function createAllisonGeometry({ detail = 'high', includeMildew = true } = {}) {
    const mobile = detail === 'mobile';
    const pieces = [], labels = [];
    const radial = mobile ? 18 : 36, fine = mobile ? 4 : 8;

    function add(g, { kind = SKIN, color = C.skin, skin = kind === SKIN ? 1 : 0, head = 0, emission = 0, label = '', shade } = {}) {
        if (!g.index) g.setIndex(Array.from({ length: g.attributes.position.count }, (_, i) => i));
        const sourcePositions=g.attributes.position.array.slice();
        // Adult proportions: shorten the upper head while shoulder-length falls stay anchored.
        if(head){
            const positions=g.attributes.position;
            for(let i=0;i<positions.count;i++){
                const y=positions.getY(i),h=typeof head==='function'?head(y):head;
                positions.setXYZ(i,positions.getX(i)*(1-.055*h),y-Math.max(0,y-1.188)*.105*h-.018*h*smooth(1.14,1.176,y),positions.getZ(i)*(1-.035*h));
            }
            g.computeVertexNormals();
        }
        if (!g.attributes.normal) g.computeVertexNormals();
        const ns=g.attributes.normal;
        for(let i=0;i<ns.count;i++){
            const n=new Vector3(ns.getX(i),ns.getY(i),ns.getZ(i));
            if(n.lengthSq()<1e-12)n.set(0,0,1);else n.normalize();
            ns.setXYZ(i,n.x,n.y,n.z);
        }
        const p = g.attributes.position, count = p.count, colors = [], skins = [], heads = [], kinds = [], emits = [];
        const tint = new Color(color);
        for (let i = 0; i < count; i++) {
            const x = sourcePositions[i*3], y = sourcePositions[i*3+1], z = sourcePositions[i*3+2], c = tint.clone();
            if (shade) shade(c, x, y, z, i, g);
            if (kind === SKIN) {
                const mottling = Math.sin(x * 44 + y * 31) * Math.sin(z * 47 - y * 23);
                c.multiplyScalar(.96 + .035 * mottling);
                c.g *= .99 + .015 * Math.sin(y * 11); c.b *= 1.005;
            }
            colors.push(c.r, c.g, c.b); skins.push(skin); heads.push(typeof head === 'function' ? head(y) : head);
            kinds.push(kind); emits.push(emission);
        }
        for (const name of Object.keys(g.attributes)) if (!['position', 'normal'].includes(name)) g.deleteAttribute(name);
        g.setAttribute('color', new Float32BufferAttribute(colors, 3));
        g.setAttribute('skin', new Float32BufferAttribute(skins, 1)); g.setAttribute('head', new Float32BufferAttribute(heads, 1));
        g.setAttribute('kind', new Float32BufferAttribute(kinds, 1)); g.setAttribute('glow', new Float32BufferAttribute(emits, 1));
        pieces.push(g); labels.push(label);
    }
    function oval(at, size, options, segments = radial, rows = mobile ? 10 : 16) {
        if(mobile){
            const radius=Math.max(...size);
            const limits=radius<.008?[6,4]:radius<.035?[12,8]:[18,10];
            segments=Math.min(segments,limits[0]);rows=Math.min(rows,limits[1]);
        }
        const g = new SphereGeometry(1, segments, rows); g.scale(...size); g.translate(...at); add(g, options);
    }
    function line(points, r, options, n = mobile ? 8 : 14) { add(sweep(points, r, r, mobile?Math.max(3,Math.round(n*.55)):n, fine, (t) => .65 + .35 * Math.sin(Math.PI * t)), options); }

    // A full shirt, with a shaped waist, shoulder line and restrained fabric folds.
    const shirtRows = [
        [.695, .108, .078, 0, 0], [.735, .108, .079, 0, 0], [.80, .105, .075, -.005, 0],
        [.87, .124, .082, -.004, 0], [.97, .153, .090, -.008, 0], [1.035, .160, .078, -.011, 0],
        [1.078, .128, .069, -.009, 0], [1.106, .051, .046, -.004, 0],
    ];
    add(loft(shirtRows, radial, mobile ? 18 : 34, (p, theta, v) => {
        const r = (.0022 * Math.sin(theta * 7 + v * 16) + .0017 * Math.sin(theta * 11 - v * 24)) * Math.sin(v * Math.PI);
        p[0] += r * Math.sin(theta); p[2] += r * Math.cos(theta);
        if (Math.cos(theta) > .5) p[2] += .0017 * Math.sin(p[1] * 74 + Math.abs(p[0]) * 30);
        return p;
    }), { kind: SHIRT, color: C.shirt, label: 'linen-shirt', shade: (c, x, y, z) => c.multiplyScalar(.97 + .025 * Math.sin(x * 56 + y * 48)) });

    // Rolled, deep navy trousers; separate trouser legs meet under the apron.
    add(loft([[.603,.111,.070,0,0],[.647,.129,.078,0,0],[.691,.121,.079,0,0],[.724,.107,.074,0,0]],
        mobile?18:30,mobile?10:18),{kind:PANTS,color:C.pants,label:'tailored-trouser-seat'});
    for (const side of [-1, 1]) {
        const cx = side * .074;
        const rows = [[.175,.044,.043,.008,cx],[.24,.048,.046,.001,cx],[.36,.048,.047,-.007,cx],
            [.45,.052,.049,-.007,cx],[.58,.063,.055,-.004,cx],[.685,.070,.060,0,cx],[.724,.070,.063,0,cx]];
        add(loft(rows, mobile ? 14 : 22, mobile ? 16 : 26, (p, a, v) => {
            const fold = .0024 * Math.sin(a * 6 + v * 13) + .0028 * gauss(p[1], .42, .032) * Math.cos(a * 5);
            p[0] += fold * Math.sin(a); p[2] += fold * Math.cos(a); return p;
        }), { kind: PANTS, color: C.pants, label: 'trousers', shade:(c,x,y,z)=>c.multiplyScalar(.93+.06*Math.sin(y*16+z*20)) });
        add(loft([[.158,.047,.045,.008,cx],[.164,.051,.048,.008,cx],[.190,.052,.049,.007,cx],[.203,.047,.044,.006,cx]],
            mobile ? 14 : 22, 6), { kind: PANTS, color: C.cuff, label: 'rolled-trouser-cuff' });
        line([[cx-.04,.194,.033],[cx,.192,.057],[cx+.04,.194,.033]], .0012, {kind:PANTS,color:0x667189}, 10);
        add(loft([[.037,.030,.035,.006,cx],[.093,.028,.029,.005,cx],[.16,.033,.031,.005,cx]], mobile?14:22, 10), {label:'bare-ankle'});

        // Broad, low arch and distinct toes; the scalloped membranes are actual geometry.
        oval([cx,.034,.050], [.047,.031,.086], {label:'bare-foot'}, mobile?18:28, 12);
        oval([cx,.031,-.015],[.032,.028,.037],{label:'heel'},mobile?12:20,10);
        const tx = [-.030,-.011,.008,.026,.040], tz = [.135,.148,.144,.135,.121], tr = [.014,.0118,.011,.010,.0085];
        for(let t=0;t<5;t++) {
            oval([cx + side*tx[t], .023, tz[t]], [tr[t],.0165,.024], {label:'toe'}, mobile?12:18, 10);
            oval([cx + side*tx[t],.031,tz[t]+.010], [tr[t]*.64,.003,.010], {kind:SILVER,color:0xd9e2df,label:'pearl-toenail'},12,6);
        }
        for(let t=0;t<4;t++) {
            const left=cx+side*tx[t], right=cx+side*tx[t+1];
            const end=(tz[t]+tz[t+1])*.5+.008;
            const web=surface(6,5,(u,v)=>[left+(right-left)*u,.026 + .006*Math.sin(Math.PI*u)*Math.sin(Math.PI*v),.076+(end-.076-.019*Math.sin(Math.PI*u))*v]);
            add(web,{color:0xd4e6e8,label:'toe-web'});
            line([[left,.026,end],[.5*(left+right),.030,end-.019],[right,.026,end]],.0012,{color:0x9ebdcb,label:'web-rim'},10);
        }
    }

    // Wine-coloured service apron: shaped cloth, bound hem and an actual pocket.
    const apron = surface(mobile?12:20,mobile?14:24,(u,v)=>{
        const y=.402+.306*v, width=.134-.032*v, a=(u-.5)*2;
        return [width*a, y+.005*Math.cos(a*Math.PI), .081+.013*(1-a*a)+.004*Math.sin(a*15+v*4)*Math.sin(v*Math.PI)];
    });
    add(apron,{kind:APRON,color:C.apron,label:'bar-apron',shade:(c,x,y,z)=>c.multiplyScalar(.91+.08*Math.sin(x*45+y*15))});
    for(const side of [-1,1])line([[side*.132,.41,.083],[side*.116,.55,.087],[side*.102,.71,.083]],.0012,{kind:APRON,color:C.stitch});
    line([[-.13,.407,.083],[0,.413,.099],[.13,.407,.083]],.0014,{kind:APRON,color:C.stitch});
    add(surface(12,8,(u,v)=>[.009+.068*u,.554+.060*v,.098+.004*Math.sin(u*Math.PI)*Math.sin(v*Math.PI)]),{kind:APRON,color:0x773c52,label:'apron-pocket'});
    line([[.009,.615,.099],[.043,.614,.100],[.077,.615,.099]],.0011,{kind:APRON,color:C.stitch});
    line([[-.108,.711,.077],[0,.713,.088],[.108,.711,.077]],.004,{kind:APRON,color:C.apron,label:'apron-waist-tie'});
    line([[.102,.705,.045],[.136,.684,.040],[.154,.660,.054],[.132,.646,.056],[.117,.677,.044]],.004,{kind:APRON,color:0x74374c,label:'tie-bow'});
    line([[.124,.682,.049],[.148,.615,.046],[.132,.574,.049]],.004,{kind:APRON,color:C.apron,label:'tie-end'});

    // Shirt front: button placket, mother-of-pearl buttons, sewn chest pocket.
    line([[0,.74,.083],[0,.86,.088],[0,1.023,.082]], .0024,{kind:SHIRT,color:C.fold,label:'button-placket'},18);
    for(const y of [.76,.825,.89,.955,1.013]){
        oval([0,y,y>.99?.083:.090],[.0041,.0041,.0018],{kind:BADGE,color:C.pearl,label:'shirt-button'},12,8);
        for(const x of [-.0012,.0012])oval([x,y,.092],[.0005,.0008,.0005],{kind:BADGE,color:0x829195},8,5);
    }
    add(surface(10,10,(u,v)=>[-.103+.058*u,.941+.063*v,.087+.007*Math.sin(u*Math.PI)*Math.sin(v*Math.PI)]),{kind:SHIRT,color:0xe8e7df,label:'shirt-pocket'});
    line([[-.103,1.005,.087],[-.074,1.004,.094],[-.045,1.005,.090]],.0012,{kind:SHIRT,color:0xc9cdd0});
    // A small pointed, open shirt collar.
    for(const side of [-1,1]){
        add(surface(8,9,(u,v)=>{
            const topx=.012+.049*u,bottomx=.042+.004*(u-.5);
            const x=side*(topx*(1-v)+bottomx*v);
            const y=(1.106-.021*u)*(1-v)+(1.051+.002*Math.cos(Math.PI*u))*v;
            const z=.049+.037*v+.007*Math.sin(Math.PI*u)*Math.sin(Math.PI*v);
            return[x,y,z];
        }),{kind:SHIRT,color:0xfffaf0,label:'folded-collar'});
        line([[side*.014,1.105,.050],[side*.029,1.075,.073],[side*.042,1.053,.087]],.0008,{kind:SHIRT,color:0xdbdfdd},10);
    }

    // A restrained staff card for The Door in the Floor.
    line([[-.036,1.086,.058],[-.040,1.025,.096],[-.027,.965,.099],[.008,.988,.102],[.028,1.057,.065]],.0016,{kind:APRON,color:0x667983,label:'staff-lanyard'},18);
    add(surface(6,6,(u,v)=>[-.047+.044*u,.922+.052*v,.106]),{kind:BADGE,color:0xe5dfcc,label:'employee-card'});
    line([[-.031,.948,.108],[-.031,.963,.108],[-.019,.963,.108],[-.019,.948,.108]],.001,
        {kind:BADGE,color:0x7b5b63,label:'staff-door-emblem'},10);
    for(const y of [.940,.934])line([[-.038,y,.108],[-.026,y,.108],[-.012,y,.108]],.0007,{kind:BADGE,color:0x7b7d81},8);

    // Arms follow a coherent elbow/wrist path; the right hand is raised to the plaque.
    const arms=[{s:-1, shoulder:[-.143,1.038,-.001],elbow:[-.188,.834,.010],wrist:[-.209,.610,.029]},
        {s:1,shoulder:[.142,1.035,.004],elbow:[.285,.980,.089],wrist:[.332,1.163,.228]}];
    for(const arm of arms){
        const a=vec(arm.shoulder), b=vec(arm.elbow), w=vec(arm.wrist);
        const middle=a.clone().lerp(b,.50); middle.z+=.006;
        add(sweep([arm.shoulder,[middle.x,middle.y,middle.z],arm.elbow],.044,.039,mobile?12:20,mobile?12:20,t=>1.12-.24*t,.018),
            {kind:SHIRT,color:C.shirt,label:'shirt-sleeve',shade:(c,x,y,z)=>c.multiplyScalar(.95+.04*Math.sin(y*57+x*13))});
        const cuffStart=a.clone().lerp(b,.83), cuffEnd=a.clone().lerp(b,1.02);
        add(sweep([[cuffStart.x,cuffStart.y,cuffStart.z],arm.elbow,[cuffEnd.x,cuffEnd.y,cuffEnd.z]],.038,.036,6,mobile?12:20,t=>1+.07*Math.sin(t*Math.PI)),
            {kind:SHIRT,color:0xdfe3df,label:'rolled-sleeve-cuff'});
        const fore=b.clone().lerp(w,.48);fore.z+=.006;
        add(sweep([arm.elbow,[fore.x,fore.y,fore.z],arm.wrist],.031,.028,mobile?12:20,mobile?12:20,t=>.93+.14*Math.sin(Math.PI*t)-.22*smooth(.46,1,t)),{label:'forearm'});
        if(arm.s===-1){
            oval([-.215,.570,.038],[.026,.041,.016],{label:'left-palm'},mobile?16:24,12);
            for(let f=0;f<4;f++){
                const x=-.235+f*.012;
                line([[x,.550,.043],[x+.001,.529,.048],[x+.004,.513+(f===3?.010:0),.040]],.0055,{label:'left-finger'},mobile?7:12);
                oval([x+.002,.516+(f===3?.009:0),.047],[.0039,.0065,.001],{kind:SILVER,color:0xd6e2e7},10,6);
            }
            line([[-.190,.582,.041],[-.175,.557,.052],[-.181,.545,.061]],.009,{label:'left-thumb'},10);
        }else{
            const palm=new SphereGeometry(1,mobile?16:24,12);palm.scale(.025,.034,.015);palm.rotateX(.39);palm.rotateZ(-.12);palm.translate(.344,1.188,.246);add(palm,{label:'right-palm'});
            for(let f=0;f<4;f++){
                const x=.328+f*.012, h=f===0?.047:f===1?.053:f===2?.044:.031;
                line([[x,1.201,.248],[x-.003,1.223,.259],[x-.006,1.201+h,.273],[x-.008,1.201+h-.004,.279]],.0055,{label:'raised-finger'},mobile?8:14);
                oval([x-.007,1.198+h,.281],[.0032,.0045,.0008],{kind:SILVER,color:0xdce5e8},10,6);
            }
            line([[.326,1.180,.254],[.306,1.205,.272],[.309,1.223,.277]],.009,{label:'right-thumb'},12);
            for(const q of [[.328,1.182,.264],[.358,1.205,.264],[.303,1.216,.282]])oval(q,[.0035,.005,.002],{kind:SILVER,color:0xebf0eb,label:'silver-mildew'},10,6);
        }
        const pts=[b.clone().lerp(w,.30),b.clone().lerp(w,.50),b.clone().lerp(w,.77),w.clone()];
        line(pts.map(p=>[p.x+.015,p.y,p.z+.020]),.0007,{kind:SILVER,color:C.silver,label:'forearm-silver-vein'},mobile?9:16);
    }

    // A shorter neck and an adult face with a softly squared jaw.
    add(loft([[1.067,.050,.044,-.006,0],[1.115,.047,.041,-.005,0],[1.168,.044,.039,-.002,0],[1.199,.046,.040,-.007,0]],
        radial,16,(p,a)=>{
            const pouch=.0035*gauss(p[1],1.169,.022)*Math.pow(Math.abs(Math.sin(a)),6);
            p[0]+=pouch*Math.sin(a);return p;
        }),{label:'neck-and-gill-pouches'});
    const headRows=[
        [1.176,.021,.028,.011,0],[1.187,.045,.056,.006,0],[1.205,.071,.073,-.005,0],
        [1.232,.082,.081,-.013,0],[1.264,.099,.091,-.026,0],[1.298,.102,.097,-.028,0],
        [1.331,.100,.102,-.032,0],[1.365,.096,.105,-.033,0],[1.400,.084,.097,-.034,0],
        [1.432,.049,.060,-.033,0],[1.449,.004,.006,-.032,0],
    ];
    function faceZ(x,y){
        const rx=Math.max(.012,profile(headRows,y,1)),rz=profile(headRows,y,2),zc=profile(headRows,y,3);
        let z=zc+rz*Math.sqrt(Math.max(0,1-(x/rx)**2));
        z+=.009*gauss(Math.abs(x),.070,.026)*gauss(y,1.295,.025);
        z-=.009*gauss(Math.abs(x),.044,.024)*gauss(y,1.325,.016);
        z+=.008*gauss(x,0,.017)*gauss(y,1.317,.038);
        z+=.025*gauss(x,0,.022)*gauss(y,1.281,.015);
        z+=.005*gauss(Math.abs(x),.017,.010)*gauss(y,1.278,.011);
        z+=.009*gauss(x,0,.035)*gauss(y,1.244,.019);
        z+=.009*gauss(x,0,.036)*gauss(y,1.201,.016);
        z+=.003*gauss(Math.abs(x),.042,.035)*gauss(y,1.348,.013);
        return z;
    }
    add(loft(headRows,mobile?32:64,mobile?30:56,(p,a)=>{
        if(Math.cos(a)>0){const original=profile(headRows,p[1],3)+profile(headRows,p[1],2)*Math.cos(a);p[2]+= (faceZ(p[0],p[1])-original)*smooth(0,.25,Math.cos(a));}
        return p;
    }),{head:1,label:'sculpted-face',shade:(c,x,y,z)=>{
        const blush=gauss(Math.abs(x),.070,.031)*gauss(y,1.280,.024)*smooth(.015,.065,z);
        c.r*=1-.018*blush;c.g*=1-.025*blush;
    }});

    // Violet almond-shaped eyes lie in their sockets. No separate protruding eyeballs.
    for(const side of [-1,1]){
        const ex=side*.043,ey=1.326,half=.0255;
        const eyeY=(t,upper)=>ey+(upper?.0100:-.0068)*Math.pow(Math.sin(Math.PI*t),.80)+side*(-half+2*half*t)*.095;
        const eye=surface(mobile?22:40,mobile?6:12,(u,v)=>{
            const x=ex-half+2*half*u,y=eyeY(u,false)+(eyeY(u,true)-eyeY(u,false))*v;
            return[x,y,faceZ(x,y)+.0013+.0007*Math.sin(Math.PI*u)*Math.sin(Math.PI*v)];
        });
        add(eye,{kind:EYES,color:0xe2e5ee,head:1,emission:0,label:'inset-eye-surface'});
        const iris=outward(surface(mobile?32:56,mobile?7:12,(u,v)=>{
            const a=u*Math.PI*2,r=.0086*v,x=ex+r*Math.cos(a),y=ey+r*Math.sin(a);
            const t=(x-ex+half)/(2*half),lower=eyeY(t,false)+.0005,upper=eyeY(t,true)-.0005;
            const cy=Math.max(lower,Math.min(upper,y));
            return[x,cy,faceZ(x,cy)+.0025+.0004*(1-v*v)];
        },true));
        add(iris,{kind:EYES,color:0x9463db,head:1,emission:.25,label:'violet-iris',shade:(c,x,y)=>{
            const r=Math.hypot(x-ex,y-ey)/.0086;
            c.multiplyScalar(.80+.25*Math.sin(r*Math.PI));
        }});
        oval([ex,ey,faceZ(ex,ey)+.0038],[.0030,.0034,.0004],
            {kind:EYES,color:0x332950,head:1,label:'quiet-pupil'},mobile?14:24,10);
        // Lids merge into the face; a very fine upper edge defines the gaze.
        for(const upper of [true,false]){
            const pts=[];
            for(let i=0;i<=18;i++){const t=i/18,x=ex-half+2*half*t,y=eyeY(t,upper);pts.push([x,y,faceZ(x,y)+.0018]);}
            line(pts,upper?.0016:.0011,{head:1,color:upper?0xc5d9e4:0xe0e9ef,label:'natural-eyelid'},mobile?15:28);
            if(upper)line(pts.map(p=>[p[0],p[1]-.0004,p[2]+.0007]),.00055,{kind:INK,color:0x637284,head:1,label:'eye-edge'},mobile?15:28);
        }
        oval([ex-.0024,ey+.0024,faceZ(ex-.0024,ey+.0024)+.0043],[.00075,.00075,.0003],
            {kind:EYES,color:0xe4d6ff,head:1,emission:.5,label:'soft-eye-light'},8,5);
        const brow=[];
        for(let i=0;i<=14;i++){
            const t=i/14,x=ex-.028+.056*t,y=1.350+.0036*Math.sin(Math.PI*t)+side*(x-ex)*.045;
            brow.push([x,y,faceZ(x,y)+.002]);
        }
        add(sweep(brow,.0027,.0016,mobile?12:22,fine,t=>.40+.60*Math.sin(Math.PI*(.10+.82*t))),
            {kind:HAIR,color:0xb39559,head:1,label:'relaxed-eyebrow'});
        line([[side*.010,1.271,faceZ(side*.010,1.271)+.0007],
              [side*.017,1.270,faceZ(side*.017,1.270)+.001],
              [side*.021,1.273,faceZ(side*.021,1.273)+.0007]],.00065,
            {kind:INK,color:0x91a5b5,head:1,label:'nostril'},10);

        // The breathing pouches sit under the jaw, attached to the neck.
        for(let g=0;g<3;g++){
            const y=1.151+g*.007;
            line([[side*.038,y+.0015,.024],[side*.044,y,.015],[side*.047,y-.0015,.004]],.00055,
                {kind:INK,color:0x9bb3bf,head:1,label:'gill-slit'},10);
        }
        oval([side*.099,1.310,-.032],[.008,.020,.014],{head:1,color:0xcdddE6,label:'pinna'},mobile?12:20,12);
        const vein=[[side*.083,1.365],[side*.081,1.339],[side*.079,1.311],[side*.069,1.293],[side*.075,1.271]];
        line(vein.map(([x,y])=>[x,y,faceZ(x,y)+.0007]),.00035,
            {kind:SILVER,color:0xd2e0e3,head:1,label:'silver-face-vein'},mobile?12:24);
        line([[side*.078,1.311],[side*.065,1.305],[side*.058,1.290]].map(([x,y])=>[x,y,faceZ(x,y)+.0007]),.00028,
            {kind:SILVER,color:0xcfdfe3,head:1},12);
    }

    // Resting closed lips, with gentle volume instead of a painted grin.
    for(const upper of [true,false]){
        add(surface(mobile?20:36,6,(u,v)=>{
            const x=-.030+.060*u,t=x/.030,seam=1.243+.00065*t*t;
            const cupid=.0010+.0020*gauss(Math.abs(x),.012,.008);
            const extent=upper?cupid:-.0040*(1-t*t);
            const y=seam+extent*v;
            return[x,y,faceZ(x,y)+.0007+.0015*Math.sin(Math.PI*v)*(1-t*t)];
        }),{color:upper?0xa99aab:C.lip,skin:.32,head:1,label:'natural-lip'});
    }
    const mouthPts=[];
    for(let i=0;i<=22;i++){
        const x=-.031+.062*i/22,t=x/.031,y=1.243+.00065*t*t;
        mouthPts.push([x,y,faceZ(x,y)+.0010]);
    }
    line(mouthPts,.00045,{kind:INK,color:0x818393,head:1,label:'closed-mouth'},mobile?18:32);

    // A rounded crown with a curved hairline and an offset part.
    const crown=outward(surface(mobile?36:64,mobile?15:28,(u,v)=>{
        const a=u*Math.PI*2,front=smooth(-.1,.75,Math.cos(a));
        const cut=2.18-.92*front+.025*Math.sin(a*2),t=.009+v*cut;
        const rib=1+.009*Math.sin(a*15+t*3);
        return[.117*Math.sin(t)*Math.sin(a)*rib,1.321+.158*Math.cos(t),-.038+.122*Math.sin(t)*Math.cos(a)*rib];
    },true));
    add(crown,{kind:HAIR,color:C.hair,head:1,label:'soft-parted-crown',shade:(c,x,y,z)=>{
        c.multiplyScalar(.88+.09*smooth(1.32,1.48,y)+.018*Math.sin(x*100+z*60));
    }});
    const hairHead=y=>smooth(1.085,1.385,y);
    // Stable frames keep each lock broad across the silhouette and shallow in depth.
    function lock(points,w,d,seed){
        const curve=new CatmullRomCurve3(points.map(vec),false,'centripetal');
        const along=mobile?20:36,around=mobile?10:14;
        const g=closeRings(surface(around,along,(u,v)=>{
            const p=curve.getPoint(v),t=curve.getTangent(v).normalize();
            let width=new Vector3().crossVectors(new Vector3(0,0,1),t).normalize();
            if(width.lengthSq()<.01)width.set(1,0,0);
            const depth=new Vector3().crossVectors(t,width).normalize(),a=u*Math.PI*2;
            const taper=(.79+.21*Math.sin(Math.PI*v))*(1-.60*smooth(.86,1,v));
            const rib=1+.012*Math.cos(a*6+seed);
            p.addScaledVector(width,Math.cos(a)*w*taper*rib).addScaledVector(depth,Math.sin(a)*d*taper*rib);
            return[p.x,p.y,p.z];
        },true),around,along);
        add(g,{kind:HAIR,color:C.hair,head:hairHead,label:'flowing-hair-lock',shade:(c,x,y,z,i)=>{
            const a=(i%(around+1))/around*Math.PI*2;
            c.multiplyScalar(.88+.085*Math.sin(a)+.040*Math.cos(a*6+seed));
            c.r*=1.015;c.b*=.96;
        }});
    }
    // A connected inner fall fills the gaps between the individual back waves.
    add(loft([[.879,.065,.024,-.119,0],[.909,.107,.030,-.113,0],
              [.990,.121,.034,-.102,0],[1.112,.135,.039,-.087,0],
              [1.245,.128,.041,-.079,0],[1.355,.104,.045,-.070,0],
              [1.420,.076,.034,-.058,0],[1.462,.017,.012,-.044,0]],mobile?22:38,mobile?34:64,
        (p,a,v)=>{p[0]+=.004*Math.sin(v*Math.PI*3+a*.7)*Math.sin(a);p[2]+=.003*Math.sin(v*Math.PI*3+a*4);return p;}),
        {kind:HAIR,color:0xd8b264,head:hairHead,label:'connected-back-hair'});
    const rear=mobile?7:11;
    for(let i=0;i<rear;i++){
        const q=i/(rear-1)*2-1,phase=i*.7,pts=[];
        const bottom=.835+.020*Math.abs(q)+.009*Math.sin(i*1.6);
        for(let j=0;j<=13;j++){
            const t=j/13,y=1.474+(bottom-1.474)*t;
            const cy=Math.min(.998,Math.max(-1,(y-1.321)/.158)),cr=Math.sqrt(Math.max(0,1-cy*cy));
            const x=(y>1.321?q*.112*cr:q*.114)+.012*Math.sin(t*Math.PI*4+phase)*Math.sin(Math.PI*t);
            const zc=-.038-.123*cr*Math.sqrt(Math.max(0,1-(q*.112/.117)**2))-.004;
            const zl=-.136-.014*Math.sin(t*Math.PI)+.019*Math.cos(t*Math.PI*4+phase);
            const blend=smooth(1.26,1.35,y);pts.push([x,y,zl*(1-blend)+zc*blend]);
        }
        const tail=pts.at(-1),bend=q===0?1:Math.sign(q);
        pts.push([tail[0]+bend*.007,tail[1]-.008,tail[2]+.004],
                 [tail[0]+bend*.014,tail[1]-.004,tail[2]+.009]);
        lock(pts,mobile?.022:.020,.010,i);
    }
    // Two soft S-waves on each shoulder. Ends turn into the wave, never into spikes.
    for(const side of [-1,1]){
        const count=mobile?2:3;
        for(let i=0;i<count;i++){
            const o=i*.014;
            const pts=[[side*(.006+i*.011)-.008,1.475-i*.004,.009-i*.010],
                [side*(.066+o*.6),1.444-i*.008,.068-i*.005],
                [side*(.108+o*.6),1.388-i*.005,.072-i*.006],
                [side*(.122+o),1.303,.027+i*.002],
                [side*(.130+o*.8),1.218,.025+i*.006],
                [side*(.147+o*.6),1.140,.064+i*.004],
                [side*(.151+o*.7),1.072,.112-i*.006],
                [side*(.131+o*.9),1.006,.124-i*.006],
                [side*(.137+o*.7),.947,.112-i*.005],
                [side*(.124+o*.9),.900+i*.014,.101-i*.004],
                [side*(.113+o),.888+i*.016,.090-i*.004]];
            lock(pts,i===0?.026:.020,.0105,side*4+i*.8);
        }
    }
    // Short roots follow the sweep of the part over the crown, hiding a straight cut edge.
    lock([[-.020,1.477,.001],[.010,1.449,.081],[.047,1.413,.105],[.078,1.383,.104],[.112,1.355,.066]],.028,.009,4.5);
    lock([[-.020,1.477,.001],[-.050,1.450,.074],[-.082,1.413,.098],[-.111,1.367,.068]],.028,.009,2.8);
    line([[-.020,1.478,-.049],[-.020,1.480,-.011],[-.019,1.475,.017]],.00075,
        {head:1,color:0xcbdade,label:'hair-part'},18);

    // A trace of the silver mildew he sheds when excited. No extra floating effects.
    if(includeMildew)for(const [x,z,r]of[[.31,.26,.019],[.29,.29,.012],[.34,.22,.009]])oval([x,.003,z],[r,.002,r*.78],{kind:SILVER,color:0xb7cbd3,label:'silver-mildew-on-paving'},mobile?12:18,6);

    // Keep indexed vertices: detail does not need a triangle soup or a forest of draw calls.
    const positions=[],normals=[],colors=[],skins=[],heads=[],kinds=[],glows=[],indices=[];
    let offset=0;
    const componentTriangles={};
    for(let pieceIndex=0;pieceIndex<pieces.length;pieceIndex++){
        const g=pieces[pieceIndex],label=labels[pieceIndex]||'detail';
        componentTriangles[label]=(componentTriangles[label]||0)+g.index.count/3;
        for(const [name,array]of [['position',positions],['normal',normals],['color',colors],['skin',skins],['head',heads],['kind',kinds],['glow',glows]])array.push(...g.attributes[name].array);
        for(const idx of g.index.array)indices.push(idx+offset);
        offset+=g.attributes.position.count;g.dispose();
    }
    const out=new BufferGeometry();
    out.setAttribute('position',new Float32BufferAttribute(positions,3));out.setAttribute('normal',new Float32BufferAttribute(normals,3));
    out.setAttribute('color',new Float32BufferAttribute(colors,3));
    for(const [name,data]of[['skin',skins],['head',heads],['kind',kinds],['glow',glows]])out.setAttribute(name,new Float32BufferAttribute(data,1));
    out.setIndex(indices);out.scale(SCALE,SCALE,SCALE);out.computeBoundingBox();out.computeBoundingSphere();
    out.name=`Allison_${detail}`;
    out.userData={character:'Allison',artist:'Edith Mina Lyre',detail,labels:[...new Set(labels.filter(Boolean))],triangleCount:indices.length/3,componentTriangles};
    return out;
}

function extendShader(material,label,change){
    const previous=material.onBeforeCompile,key=material.customProgramCacheKey();
    material.onBeforeCompile=(shader,renderer)=>{previous.call(material,shader,renderer);change(shader);};
    material.customProgramCacheKey=()=>`${key}|${label}`;
}

/** API-compatible with the game's original createAllison. detail is optional. */
export function createAllison({at=[0,0,0],facing=0,gradientMap,reducedMotion=false,detail='high',includeMildew=true}={}){
    const uniforms={
        allisonJoy:{value:0},allisonTime:{value:0},allisonTurn:{value:0},
        allisonCalm:{value:new Color(ALLISON_DESIGN.palette.skin)},allisonWheat:{value:new Color(0xe8c46a)},allisonMagenta:{value:new Color(0xb02860)},
    };
    const material=new MeshToonMaterial({...(gradientMap?{gradientMap}:{}),vertexColors:true,color:0xffffff,side:DoubleSide});
    material.name='Allison_Sirenian';
    extendShader(material,'allison-revised-2026-10-03-v2',(shader)=>{
        Object.assign(shader.uniforms,uniforms);
        shader.vertexShader=shader.vertexShader
            .replace('#include <common>',`#include <common>
                attribute float skin; attribute float head; attribute float kind; attribute float glow;
                uniform float allisonJoy; uniform float allisonTime; uniform float allisonTurn;
                uniform vec3 allisonCalm; uniform vec3 allisonWheat; uniform vec3 allisonMagenta;
                varying float vAllisonSkin; varying float vAllisonKind; varying float vAllisonGlow;
                varying vec3 vAllisonAt; varying vec3 vAllisonNormal;`)
            .replace('#include <beginnormal_vertex>',`#include <beginnormal_vertex>
                float turnAngle=allisonTurn*head;
                mat3 allisonLook=mat3(cos(turnAngle),0.0,-sin(turnAngle),0.0,1.0,0.0,sin(turnAngle),0.0,cos(turnAngle));
                objectNormal=allisonLook*objectNormal; vAllisonNormal=objectNormal;`)
            .replace('#include <begin_vertex>',`#include <begin_vertex>
                transformed=allisonLook*(transformed-vec3(0.0,${ALLISON_DESIGN.neck.toFixed(6)},0.0))+vec3(0.0,${ALLISON_DESIGN.neck.toFixed(6)},0.0);
                float breath=sin(allisonTime*1.55)*0.0011;
                if(kind>1.5 && kind<2.5) transformed.z+=breath*smoothstep(0.66,0.94,position.y);
                if(kind>0.5 && kind<1.5) transformed.x+=sin(allisonTime*1.15+position.y*7.0)*0.0012*(1.0-head);
                vAllisonAt=position;vAllisonSkin=skin;vAllisonKind=kind;vAllisonGlow=glow;`)
            .replace('#include <color_vertex>',`#include <color_vertex>
                float pulse=0.5+0.5*sin(allisonTime*4.0-position.y*6.0);
                vec3 glad=mix(allisonWheat,allisonMagenta,pulse);
                vColor.rgb=mix(vColor.rgb,vColor.rgb*mix(allisonCalm,glad,allisonJoy),skin);`);
        shader.fragmentShader=shader.fragmentShader
            .replace('#include <common>',`#include <common>
                varying float vAllisonSkin; varying float vAllisonKind; varying float vAllisonGlow;
                varying vec3 vAllisonAt; varying vec3 vAllisonNormal;`)
            .replace('#include <color_fragment>',`#include <color_fragment>
                // Fine secondary silver veining, antialiased at distance.
                float veinField=sin(vAllisonAt.x*83.0+sin(vAllisonAt.y*43.0+vAllisonAt.z*23.0)*1.6);
                float aa=max(fwidth(veinField),0.025);
                float vein=(1.0-smoothstep(0.012,0.012+aa,abs(veinField)))*vAllisonSkin*0.10;
                diffuseColor.rgb=mix(diffuseColor.rgb,vec3(0.66,0.75,0.80),vein);
                // A quiet weave, averaged away when subpixel, on the white linen.
                if(vAllisonKind>1.5 && vAllisonKind<2.5){
                    float scale=max(length(fwidth(vAllisonAt))*480.0,1.0);
                    float weave=sin(vAllisonAt.x*700.0)*sin(vAllisonAt.y*700.0)*0.025/scale;
                    diffuseColor.rgb*=1.0+weave;
                }`)
            .replace('#include <emissivemap_fragment>',`#include <emissivemap_fragment>
                totalEmissiveRadiance+=vColor.rgb*vAllisonGlow;
                float satin=pow(max(0.0,dot(normalize(vAllisonNormal),normalize(vec3(-0.45,0.65,0.8)))),22.0);
                float wet=vAllisonSkin*0.028;
                float goldSheen=(vAllisonKind>0.5 && vAllisonKind<1.5)?0.027:0.0;
                totalEmissiveRadiance+=satin*(wet+goldSheen)*vec3(0.70,0.76,0.80);`);
    });
    const mesh=new Mesh(createAllisonGeometry({detail,includeMildew}),material);
    mesh.name='allison';mesh.castShadow=true;mesh.receiveShadow=true;mesh.position.set(...at);mesh.rotation.y=facing;
    const where=new Vector3(...at),point=new Vector3(at[0],at[1]+1.48,at[2]);
    let visitor=null,joy=0,turn=0,greeted=-Infinity,last=0,override=null;
    return{
        object:mesh,material,point,
        body:{center:new Vector3(at[0],at[1]+1.36*.55,at[2]),radius:.42},
        greet(elapsed){greeted=elapsed;},notice(position){visitor=position;},
        /** Optional preview controls. null restores the original visitor-driven behaviour. */
        setJoy(amount){override=amount===null?null:Math.max(0,Math.min(1,amount));},
        update(elapsed){
            const dt=Math.min(.1,Math.max(0,elapsed-last));last=elapsed;
            uniforms.allisonTime.value=reducedMotion ? .3 : elapsed;
            let want=reducedMotion?0:Math.sin(elapsed*.4)*.10-.04;
            let glad=elapsed-greeted<6?1:0;
            if(visitor){
                const dx=visitor.x-where.x,dz=visitor.z-where.z;
                if(Math.hypot(dx,dz)<4){const toward=Math.atan2(dx,dz)-facing;want=Math.max(-1.05,Math.min(1.05,Math.atan2(Math.sin(toward),Math.cos(toward))));glad=1;}
            }
            if(override!==null)glad=override;
            turn+=(want-turn)*(reducedMotion?1:1-Math.exp(-3*dt));
            joy+=(glad-joy)*(reducedMotion?1:1-Math.exp(-1.5*dt));
            uniforms.allisonTurn.value=turn;uniforms.allisonJoy.value=joy;
        },
        dispose(){mesh.geometry.dispose();material.dispose();},
    };
}

/** Preserved from the original model: the biography remains the site's own text. */
export function bioFrom(html){
    const page=new DOMParser().parseFromString(html,'text/html'),block=page.querySelector('.bio-text');
    if(!block)return null;
    const paragraphs=[],italic=[],links=[];
    for(const paragraph of block.querySelectorAll('p')){
        const words=paragraph.textContent.replace(/\s+/g,' ').trim(),linked=[...paragraph.querySelectorAll('a')];
        for(const link of linked){
            const href=link.getAttribute('href');
            if(!href||href.startsWith('mailto:')||/google\./.test(href))continue;
            const resolved=new URL(href,new URL('../',window.location.href)).href;
            if(!links.some(known=>known.href===resolved))links.push({href:resolved,label:link.textContent.trim()});
        }
        const bare=paragraph.cloneNode(true);for(const link of bare.querySelectorAll('a'))link.remove();
        const own=bare.textContent.replace(/[—–\s]+/g,' ').trim();
        if(!paragraph.classList.contains('bio-title')&&own.split(' ').filter(Boolean).length<3)continue;
        paragraphs.push(words);for(const emphasis of paragraph.querySelectorAll('em, i, cite'))italic.push(emphasis.textContent.trim());
    }
    return paragraphs.length?{text:paragraphs.join('\n\n'),italic,links}:null;
}
