/** Chapter 8: original mechanical plates, drawn in a 1000 × 760 art space.
 * These are explanatory illustrations, not manufacturer drawings. All motion is time-derived.
 */
(function () {
  const INK = '#30291f', STEEL = '#657889', LIGHT = '#d6dbd9', RED = '#ae382b';
  /** Fill and outline a drafted part. */
  function part(c, d, fill, width = 3) {
    const p = new Path2D(d); c.fillStyle = fill; c.strokeStyle = INK; c.lineWidth = width;
    c.lineJoin = 'round'; c.fill(p); c.stroke(p);
  }
  /** Draw a mechanical line with rounded joins. */
  function line(c, d, color = INK, width = 3) {
    c.strokeStyle = color; c.lineWidth = width; c.lineCap = 'round'; c.lineJoin = 'round'; c.stroke(new Path2D(d));
  }
  /** Draw a circular feature. */
  function ring(c, x, y, r, fill, stroke = INK, width = 3) {
    c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); c.fillStyle = fill; c.fill();
    c.strokeStyle = stroke; c.lineWidth = width; c.stroke();
  }
  /** Reusable machined fastener with a hexagonal head. */
  function bolt(c, x, y, r = 12) {
    ring(c, x, y, r + 5, '#b79861');
    let d = ''; for (let i = 0; i < 6; i++) d += `${i ? 'L' : 'M'}${x + r * Math.cos(i * Math.PI / 3)},${y + r * Math.sin(i * Math.PI / 3)} `;
    part(c, d + 'Z', '#e2c78e', 2); line(c, `M${x-r/2} ${y}h${r}`, '#6b5333', 2);
  }
  /** Brushed metal, with a narrow highlight rather than a flat black silhouette. */
  function metal(c, x = 200, y = 120, x2 = 700, y2 = 650) {
    const g = c.createLinearGradient(x, y, x2, y2);
    [[0,'#546777'],[.3,'#aab8bd'],[.45,'#e4e5dc'],[.53,'#8d9faa'],[1,'#475d70']].forEach(([s,v]) => g.addColorStop(s,v));
    return g;
  }
  /** An actual hand lever, fulcrum, ratchet quadrant and connected pull rod. */
  function lever(c, t) {
    part(c, 'M205 593L637 549 837 636 382 701Z', '#9b7846');
    part(c, 'M205 593L382 670 837 610 837 636 382 701 205 620Z', '#745430');
    [265,340,700,770].forEach((x,i)=>bolt(c,x,610+(i<2?i*19:0),9));
    part(c, 'M354 613L383 431 425 416 468 593Z', metal(c));
    part(c, 'M400 575A151 151 0 0 1 554 445L570 470A128 128 0 0 0 424 589Z', '#b49a6b');
    for(let i=0;i<13;i++) { const a=-1.45+i*.095; line(c,`M${410+141*Math.cos(a)} ${591+141*Math.sin(a)}l9 -4`,INK,3); }
    const angle=-.13 + .035*Math.sin(t*1.3);
    c.save(); c.translate(407,562); c.rotate(angle);
    part(c, 'M-20 14L-52 -338Q-52 -360 -36 -361L-16 -361 17 9Z', metal(c,0,-320,30,20));
    part(c, 'M-60 -346Q-76 -359 -61 -382L-78 -459Q-81 -478 -56 -484L-28 -489Q-9 -488 -8 -472L-4 -369Q1 -349 -19 -347Z', '#7a4a2e');
    for(let i=0;i<9;i++) line(c,`M-63 ${-454+i*9}l49 -8`,'#a87947',2);
    part(c,'M-3 -12L276 -74 282 -52 11 20Z', STEEL); bolt(c,274,-61,10); bolt(c,0,0,20);
    c.restore();
    const ex=407+274*Math.cos(angle)+61*Math.sin(angle),ey=562+274*Math.sin(angle)-61*Math.cos(angle);
    line(c,`M${ex} ${ey}L816 485`,'#5b6870',12);line(c,`M${ex} ${ey-3}L816 482`,'#b4beb9',3);
    bolt(c,ex,ey,10);ring(c,814,485,16,LIGHT);bolt(c,411,562,15);
  }
  /** Curved wooden brake block, iron mounting strap and riveted leather lining. */
  function wood(c) {
    part(c,'M165 284L636 190 838 318 361 415Z','#cfa467');
    part(c,'M361 415L838 318 820 528Q576 651 337 581Z','#9a683a');
    part(c,'M165 284L361 415 337 581 151 452Z','#b8884c');
    c.save(); c.clip(new Path2D('M361 415L838 318 820 528Q576 651 337 581Z'));
    for(let j=0;j<18;j++) line(c,`M315 ${420+j*10} Q510 ${452+j*11} 867 ${319+j*12}`,'#764c2d',1.6);
    for(let j=0;j<4;j++) { c.beginPath();c.ellipse(588,488,j*14+9,j*4+3,-.15,0,Math.PI*2);c.stroke(); }
    c.restore();
    part(c,'M337 563Q585 626 821 508L820 544Q583 662 337 601Z','#563b2c');
    for(let i=0;i<9;i++) {const x=365+i*51;ring(c,x,596- .00072*(x-470)**2,5,'#c7a36d',INK,1);}
    part(c,'M352 246L433 230 631 359 613 588 550 606 568 379Z',metal(c));
    part(c,'M442 229L445 160 516 145 593 190 591 271 557 278 553 215 506 186 481 192 481 240Z',metal(c));
    bolt(c,588,443,15);bolt(c,576,550,15);
    for(let i=0;i<7;i++)line(c,`M${208+i*35} ${297+i*21}l${343-i*8} -70`,'#b48349',1.4);
  }
  /** Stamped steel pedal arm with flanges, an axle eye and ribbed rubber pad. */
  function steel(c, t = 0, composite = false) {
    c.save(); c.translate(490,157);c.rotate(.12+.025*Math.sin(t));
    part(c,'M-91 -35L71 -35 86 70 49 126 84 381 169 444 142 482 35 441 -8 137 -78 77Z',composite?'#657574':metal(c,-70,0,80,450));
    part(c,'M71 -35L97 -17 110 83 75 132 112 372 189 433 169 444 84 381 49 126 86 70Z',composite?'#334c50':'#465b6b');
    ring(c,-8,22,44,'#bda477');ring(c,-8,22,26,'#383f3f');ring(c,-8,22,16,'#d2bf90');
    if(composite) {
      part(c,'M-48 86L12 104 54 388 32 408Z','#263f43');
      for(let i=0;i<8;i++)part(c,`M${-43+i*9} ${110+i*35}l47 14 3 13 -46 -13Z`,'#859890',2);
    } else { line(c,'M-41 93Q-21 180 -8 270L16 396 65 428','#dce0d8',7);line(c,'M6 100L45 381 93 418','#425564',5); }
    part(c,'M-9 411L166 391 224 455 39 489Z','#bb9a63');
    part(c,'M39 489L224 455 223 478 40 514 -9 437 -9 411Z','#654d36');
    part(c,'M3 420L159 404 208 453 45 482Z','#854b34');
    for(let i=0;i<7;i++)line(c,`M${16+i*5} ${428+i*7}L${164+i*5} ${412+i*7}`,'#3f3025',4);
    c.restore();
  }
  /** Glass-fibre laminate: an exploded stack with alternating fibre directions and moulded ribs. */
  function composite(c) {
    for(let layer=3;layer>=0;layer--) {
      c.save();c.translate(0,layer*39);
      const d='M172 269L650 171 827 326 340 433Z';
      part(c,d,['#69817a','#d0c6a4','#526d6d','#b5bda8'][layer]);
      part(c,'M340 433L827 326 827 338 340 445 172 281 172 269Z','#425654');
      c.save();c.clip(new Path2D(d));
      for(let i=-30;i<70;i++) {
        const x=i*15;
        line(c,layer%2?`M${x} 145l410 330`:`M${x} 460l700 -152`,layer%2?'#687b71':'#b8c2ac',2);
      }
      c.restore(); c.restore();
    }
    for(let i=0;i<5;i++) part(c,`M${265+i*89} ${254-i*18}l18 -36 146 126 -14 36Z`,'#3d5a5c',2);
    [ [221,280],[645,195],[772,324],[356,403] ].forEach(([x,y])=>ring(c,x,y,9,'#203c3f'));
  }
  /** Rotary position sensor with connector pins, exposed PCB and Hall IC. */
  function sensor(c,t) {
    part(c,'M221 275L296 205 558 205 641 277 641 494 562 555 294 555 221 485Z','#354d55');
    part(c,'M641 277L686 301 686 507 605 574 562 555 641 494Z','#233941');
    part(c,'M257 291L310 241 544 241 605 294 605 470 544 520 309 520 257 471Z','#698981');
    for(let i=0;i<6;i++) {
      line(c,`M${306+i*30} 271v${34+i*8}h${72-i*12}v52`,'#c9ac6b',3);
      line(c,`M${305+i*38} 490v-35h35v-45`,'#cfb37b',3);
    }
    ring(c,430,379,90,'#c0ac7a');ring(c,430,379,63,'#475e63');
    c.save();c.translate(430,379);c.rotate(t*.15);part(c,'M-12 -53L16 -53 31 -5 17 52 -17 52 -30 0Z','#cfd3c8');c.restore();
    part(c,'M537 341L587 341 587 400 537 400Z','#263e45');
    for(let i=0;i<5;i++){line(c,`M530 ${347+i*11}h-11`,'#dab36c',4);line(c,`M589 ${347+i*11}h10`,'#dab36c',4);}
    part(c,'M639 330L794 330 830 370 830 439 681 439 639 402Z','#69818a');
    part(c,'M685 351L783 351 806 377 806 412 700 412Z','#26383e');
    for(let i=0;i<4;i++)part(c,`M${703+i*23} 370h10v28h-10Z`,'#d4b16c',1);
    [[282,286],[580,286],[282,472],[580,472]].forEach(([x,y])=>bolt(c,x,y,8));
  }
  /** Three distinct cast pedals attached to a common shaft; no whole-car substitution. */
  function threePedals(c,t) {
    part(c,'M142 520L798 416 885 540 217 658Z','#847b64');
    line(c,'M187 566L838 473','#344650',32);line(c,'M187 558L838 465','#b5b7a7',8);
    for(let i=0;i<3;i++) {
      c.save();c.translate(286+i*219,540-i*36);c.rotate(-.08+(i===2?.05*Math.sin(t*3):0));
      part(c,'M-21 7L-47 -91 -26 -266 15 -271 1 -96 23 6Z',metal(c,0,-270,40,0));
      part(c,'M-86 -269Q-103 -288 -88 -335L39 -348Q60 -332 59 -285Z',i===2?'#a45136':'#5e747a');
      for(let j=0;j<6;j++)line(c,`M-79 ${-326+j*8}l121 -13`,'#d0c8ad',3);
      bolt(c,0,0,20);c.restore();
    }
  }
  /** Hydraulic master cylinder cutaway, reservoir, piston and connected brake lines. */
  function hydraulic(c,t) {
    part(c,'M273 166L452 166 452 267 273 267Z','#c9c8ac');part(c,'M260 146L467 146 467 170 260 170Z','#637075');
    part(c,'M288 205L437 205 437 258 288 258Z','#bb7a43');
    part(c,'M317 267v64h35v-64Z',LIGHT);part(c,'M402 267v64h35v-64Z',LIGHT);
    part(c,'M203 317L719 317 757 350 757 458 719 490 203 490Z',metal(c));
    part(c,'M240 349L703 349 721 368 721 439 703 458 240 458Z','#d4c8a7');
    part(c,'M401 350L705 350 720 368 720 440 704 457 401 457Z','#b77743');
    const x=325+12*Math.sin(t*2);part(c,`M${x} 348h41v111h-41Z`,'#516c7b');
    line(c,`M103 402H${x}`,'#465c68',23);line(c,`M104 396H${x}`,'#b4c0c0',5);
    for(let i=0;i<10;i++)line(c,`M${x+50+i*25} 365l23 77 5 -77`,'#534b36',3);
    line(c,'M612 316V264Q612 232 644 232H827V561H688','#4d605f',14);
    line(c,'M612 316V264Q612 232 644 232H827V561H688','#be8744',7);
    part(c,'M559 529H705V596H559Z',metal(c));line(c,'M559 562h-62m146 0h62',STEEL,20);
    line(c,'M569 540h124',LIGHT,3);bolt(c,579,582,6);bolt(c,685,582,6);
    bolt(c,222,335,8);bolt(c,737,471,8);
  }
  /** Disc/caliper assembly; wheel ring, pulse sensor or electric actuator are optional. */
  function disc(c,t,mode='disc') {
    c.save();c.translate(466,387);c.scale(.94,1);
    if(mode==='abs') {
      ring(c,0,0,301,'#4c493d');ring(c,0,0,273,'#9c9d8a');
      for(let i=0;i<48;i++){const a=i*Math.PI/24;line(c,`M${282*Math.cos(a)} ${282*Math.sin(a)}l${13*Math.cos(a+.3)} ${13*Math.sin(a+.3)}`,'#262b2a',4);}
    }
    ring(c,10,12,240,'#536773');ring(c,0,0,238,metal(c,-240,-200,240,200));
    for(let r=132;r<230;r+=11)ring(c,0,0,r,'rgba(0,0,0,0)','#82918f',1);
    c.save();c.rotate(t*.18);
    for(let i=0;i<18;i++){const a=i*Math.PI/9;for(let j=0;j<2;j++)ring(c,(167+j*38)*Math.cos(a+j*.06),(167+j*38)*Math.sin(a+j*.06),5,'#445a65',INK,1);}
    c.restore();ring(c,0,0,110,'#697b82');ring(c,0,0,66,'#b7b6a1');ring(c,0,0,35,'#3e5057');
    for(let i=0;i<5;i++)bolt(c,83*Math.cos(i*Math.PI*2/5),83*Math.sin(i*Math.PI*2/5),10);
    part(c,'M132 -182L223 -170 270 -120 270 98 225 154 144 173 110 122 143 82 181 70 181 -88 132 -112Z',RED);
    part(c,'M223 -170L305 -141 323 -98 323 90 270 98 270 -120Z','#783b2c');
    part(c,'M181 -87L208 -82 208 74 181 70Z','#c0aa7c');
    line(c,'M226 -124V104','#db8260',6);bolt(c,234,-111,10);bolt(c,234,90,10);
    if(mode==='emb') {
      part(c,'M303 -104L417 -82 446 -40 446 98 322 82Z','#688188');
      for(let j=0;j<8;j++)line(c,`M${325+j*12} -62v128`,'#344b54',4);
      part(c,'M351 -129h53v41h-53Z','#bda369');
      line(c,'M378 -129v-51h-124','#334f59',9);
    }
    if(mode==='abs') {
      part(c,'M-91 -309L-45 -320 -24 -252 -65 -240Z','#ad6941');
      line(c,'M-72 -309v-43h-139','#4a6269',8);
      for(let i=0;i<16;i++){const a=-2.8+i*.105;line(c,`M${251*Math.cos(a)} ${251*Math.sin(a)}L${260*Math.cos(a)} ${260*Math.sin(a)}`,'#ddca93',3);}
      c.globalAlpha=.35+.35*Math.sin(t*9)**2;line(c,'M220 -79V58','#f0ce7b',9);
    }
    c.restore();
  }
  /** Draw one complete, bounded plate into the requested rectangle. */
  function draw(c,id,x,y,w,h,t=0) {
    const bounds={lever:[190,65,850,710],wood:[145,138,845,665],steel:[340,102,730,725],composite:[165,130,850,570],sensor:[210,195,840,583],three:[135,145,900,670],hydraulic:[90,135,840,610],disc:[230,138,785,638],abs:[175,25,785,699],emb:[230,135,890,640],wire:[335,80,805,725]};
    const [l,top,r,b]=bounds[id]||[0,0,1000,760];
    c.save();c.translate(x+w/2,y+h/2);const s=Math.min(w/(r-l),h/(b-top))*.87;c.scale(s,s);c.translate(-(l+r)/2,-(top+b)/2);
    const f={lever,wood,steel,composite,sensor,three:threePedals,hydraulic,disc};
    if(id==='abs'||id==='emb')disc(c,t,id);
    else if(id==='wire'){
      steel(c,t);
      /** Sensor sits at the upper pivot, connected by its shaft, not beside the foot pad. */
      line(c,'M480 177H645','#475d70',22);line(c,'M480 171H645','#c8cbbb',5);
      c.save();c.translate(484,19);c.scale(.37,.37);sensor(c,t);c.restore();
      line(c,'M788 161Q831 155 830 205V413','#48626b',7);
      part(c,'M814 412h33v64h-33Z','#69818a');
      for(let j=0;j<3;j++)line(c,`M${823+j*7} 456v15`,'#d4b16c',3);
    }
    else (f[id]||steel)(c,t);
    c.restore();
  }
  window.CH8_ART={draw};
})();
