/**
 * 打包入口：把 Three.js 和用到的扩展挂到 window.THREE，供普通 <script> 使用（file:// 下不能用 ES 模块）。
 * 构建：npx esbuild src/vendor/three-entry.js --bundle --minify --format=iife --outfile=src/vendor/three.bundle.js
 */
import * as THREE_NS from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import * as BufferGeometryUtils from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { BokehPass } from 'three/examples/jsm/postprocessing/BokehPass.js';
import { GTAOPass } from 'three/examples/jsm/postprocessing/GTAOPass.js';
import { LineSegments2 } from 'three/examples/jsm/lines/LineSegments2.js';
import { LineSegmentsGeometry } from 'three/examples/jsm/lines/LineSegmentsGeometry.js';
import { LineMaterial } from 'three/examples/jsm/lines/LineMaterial.js';
import { Line2 } from 'three/examples/jsm/lines/Line2.js';
import { LineGeometry } from 'three/examples/jsm/lines/LineGeometry.js';

window.THREE = Object.assign({}, THREE_NS, {
  RoomEnvironment, RoundedBoxGeometry, BufferGeometryUtils, EffectComposer, RenderPass, UnrealBloomPass, ShaderPass, OutputPass, BokehPass, GTAOPass,
  LineSegments2, LineSegmentsGeometry, LineMaterial, Line2, LineGeometry,
});
