/* global THREE */
window.MadstoqViz = (function () {
  "use strict";

  const C = { glass: 0xa8c4d4, white: 0xf0ece4, roof: 0x6a6e72, plot: 0x4a6b55, deck: 0xc9bfb0 };

  function createMats() {
    return {
      wall: new THREE.MeshPhongMaterial({ color: C.white, shininess: 18 }),
      glass: new THREE.MeshPhongMaterial({
        color: C.glass,
        shininess: 40,
        transparent: true,
        opacity: 0.55,
      }),
      roof: new THREE.MeshPhongMaterial({ color: C.roof, shininess: 14 }),
      deck: new THREE.MeshPhongMaterial({ color: C.deck, shininess: 8 }),
      ground: new THREE.MeshPhongMaterial({ color: C.plot, shininess: 4 }),
      treeTrunk: new THREE.MeshPhongMaterial({ color: 0x5c4632 }),
      treeLeaf: new THREE.MeshPhongMaterial({ color: 0x5f8a54 }),
    };
  }

  function addBox(group, mats, w, h, d, x, y, z, key) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mats[key] || mats.wall);
    mesh.position.set(x, y + h / 2, z);
    mesh.castShadow = true;
    group.add(mesh);
  }

  function addFlatRoof(group, mats, width, depth, baseY, thickness) {
    const roof = new THREE.Mesh(new THREE.BoxGeometry(width, thickness, depth), mats.roof);
    roof.position.set(0, baseY + thickness / 2, 0);
    group.add(roof);
    const parapet = new THREE.Mesh(new THREE.BoxGeometry(width + 0.08, 0.18, depth + 0.08), mats.roof);
    parapet.position.set(0, baseY + thickness + 0.09, 0);
    group.add(parapet);
  }

  function addTree(group, mats, x, z, s) {
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.06 * s, 0.08 * s, 0.5 * s, 8), mats.treeTrunk);
    trunk.position.set(x, 0.25 * s, z);
    group.add(trunk);
    const crown = new THREE.Mesh(new THREE.ConeGeometry(0.32 * s, 0.85 * s, 10), mats.treeLeaf);
    crown.position.set(x, 0.72 * s, z);
    group.add(crown);
  }

  function buildHeroVilla(mats) {
    const g = new THREE.Group();
    addBox(g, mats, 7.5, 0.08, 5.5, 0, 0, 0, "ground");
    addBox(g, mats, 3.4, 1.05, 2.5, 0.15, 0, 0, "wall");
    addBox(g, mats, 2.8, 0.85, 0.08, 0.15, 0, 1.28, "glass");
    addBox(g, mats, 1.2, 0.12, 2.6, -1.9, 0, 0, "deck");
    addFlatRoof(g, mats, 3.6, 2.7, 1.05, 0.1);
    addTree(g, mats, 2.5, 1.85, 1);
    addTree(g, mats, -2.2, -1.7, 0.95);
    return g;
  }

  function createRenderer(canvas) {
    const r = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
    r.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    return r;
  }

  function bindResize(renderer, camera, el) {
    function resize() {
      const w = el.clientWidth;
      const h = el.clientHeight;
      if (w < 1 || h < 1) return;
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    }
    resize();
    window.addEventListener("resize", resize);
  }

  function setupLights(scene) {
    scene.add(new THREE.AmbientLight(0xffffff, 0.52));
    const sun = new THREE.DirectionalLight(0xfff4e8, 0.95);
    sun.position.set(6, 12, 8);
    scene.add(sun);
  }

  function initHero(canvas, reducedMotion) {
    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x1a2420, 0.04);
    const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 80);
    camera.position.set(5, 2.5, 8);
    const renderer = createRenderer(canvas);
    bindResize(renderer, camera, canvas.parentElement);
    setupLights(scene);

    const model = buildHeroVilla(createMats());
    scene.add(model);

    let mx = 0;
    let my = 0;
    document.querySelector(".hero")?.addEventListener("mousemove", (e) => {
      const r = canvas.getBoundingClientRect();
      mx = ((e.clientX - r.left) / r.width - 0.5) * 2;
      my = ((e.clientY - r.top) / r.height - 0.5) * 2;
    });

    const clock = new THREE.Clock();
    (function loop() {
      requestAnimationFrame(loop);
      const t = clock.getElapsedTime();
      if (!reducedMotion) {
        model.rotation.y = 0.35 + mx * 0.28 + t * 0.04;
        model.rotation.x = -0.1 + my * 0.08;
      }
      camera.lookAt(0, 0.5, 0);
      renderer.render(scene, camera);
    })();
  }

  function initBanner(canvas, reducedMotion) {
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(60, 1, 0.1, 50);
    camera.position.z = 8;
    const renderer = createRenderer(canvas);
    bindResize(renderer, camera, canvas.parentElement);

    const geo = new THREE.BufferGeometry();
    const n = 80;
    const pos = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      pos[i * 3] = (Math.random() - 0.5) * 12;
      pos[i * 3 + 1] = Math.random() * 4;
      pos[i * 3 + 2] = (Math.random() - 0.5) * 6;
    }
    geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    scene.add(
      new THREE.Points(
        geo,
        new THREE.PointsMaterial({ color: 0xb9955a, size: 0.05, transparent: true, opacity: 0.3 })
      )
    );

    (function loop() {
      requestAnimationFrame(loop);
      if (!reducedMotion) scene.rotation.y += 0.0005;
      renderer.render(scene, camera);
    })();
  }

  function init(reducedMotion) {
    if (typeof THREE === "undefined") return;
    const hero = document.getElementById("hero-canvas");
    const banner = document.getElementById("banner-canvas");
    if (hero && !hero.dataset.vizReady) {
      hero.dataset.vizReady = "1";
      initHero(hero, reducedMotion);
    }
    if (banner && !banner.dataset.vizReady) {
      banner.dataset.vizReady = "1";
      initBanner(banner, reducedMotion);
    }
  }

  return { init };
})();
