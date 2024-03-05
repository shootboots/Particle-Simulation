import { OrbitControls } from 'https://cdn.skypack.dev/three@0.132.2/examples/jsm/controls/OrbitControls.js'
        import GUI from 'https://cdn.jsdelivr.net/npm/lil-gui@0.17/+esm'
        import * as THREE from 'https://cdn.skypack.dev/three@0.144.0'

        const settings = {
            seed: 98172354122,
            fps: 0,
            dimensions: 500,
            atoms: {
                count: 500, // Per Color
                radius: 0.5
            },
            drawings: { // Drawing options can be expensive on performance
                lines: false, // draw lines between atoms that arr effecting each other
                circle: true, // draw atoms as circles
            },
            rules: {},
            rulesArray: [],
            colors: ['green', 'red', 'purple', 'yellow'],
            time_scale: 1.0,
            cutOff: 6400 * 2, // interaction distance cut-off
            viscosity: 0.7, // speed-dampening
            pulseDuration: 10,
            randomRules: () => {
                randomRules()
                randomAtoms(settings.atoms.count, true)
            },
            gui: null,
            scene: {
                camera: null,
                scene: null,
                renderer: null,
                controls: null,
                atomsGroup: null,
            }
        }
        // const addGridHelper = () => {
        //     if (settings.scene.gridHelper) {
        //         settings.scene.gridHelper.parent.remove(settings.scene.gridHelper)
        //     }
        //     settings.scene.gridHelper = new THREE.GridHelper(settings.dimensions, 10)
        //     settings.scene.gridHelper.position.x = settings.dimensions / 2
        //     settings.scene.gridHelper.position.y = 0
        //     settings.scene.gridHelper.position.z = settings.dimensions / 2
        //     settings.scene.scene.add(settings.scene.gridHelper)
        // }
        const initialiseScene = () => {
            const container = document.createElement('div');
            document.body.appendChild(container);

            const aspect = window.innerWidth / window.innerHeight;
            settings.scene.camera = new THREE.PerspectiveCamera(45, aspect, 0.1, 5000);
            settings.scene.camera.position.x = settings.dimensions * 2
            settings.scene.camera.position.y = settings.dimensions * 2
            settings.scene.camera.position.z = settings.dimensions * 2
            settings.scene.scene = new THREE.Scene();

            settings.scene.atomsGroup = new THREE.Group()
            settings.scene.scene.add(settings.scene.atomsGroup)

            settings.scene.renderer = new THREE.WebGLRenderer()
            settings.scene.renderer.setPixelRatio(window.devicePixelRatio)
            settings.scene.renderer.setSize(window.innerWidth, window.innerHeight)
            container.appendChild(settings.scene.renderer.domElement)

            settings.scene.controls = new OrbitControls(settings.scene.camera, settings.scene.renderer.domElement)
            settings.scene.controls.target = new THREE.Vector3(settings.dimensions / 2, settings.dimensions / 2, settings.dimensions / 2)
            settings.scene.controls.update()

            // addGridHelper()
            
        }


        Object.defineProperty(String.prototype, 'capitalise', {
            value: function() {
                return this.charAt(0).toUpperCase() + this.slice(1);
            },
            enumerable: false
        })

        // Build GUI
        const setupGUI = () => {
            settings.gui = new GUI({
                title: 'Configuration'
            })

            settings.gui.add(settings, 'randomRules').name('Randomise')
        }


        // Seedable 'decent' random generator
        function randomSeed() {
            var t = settings.seed += 0x6D2B79F5;
            t = Math.imul(t ^ t >>> 15, t | 1);
            t ^= t + Math.imul(t ^ t >>> 7, t | 61);
            return ((t ^ t >>> 14) >>> 0) / 4294967296.;
        }

        console.log(randomSeed())

        function randomRules() {
            if (!isFinite(settings.seed)) settings.seed = 0xcafecafe;
            console.log("Seed=" + settings.seed);
            window.location.hash = "#" + settings.seed;
            for (var i of settings.colors) {
                settings.rules[i] = {};
                for (var j of settings.colors) {
                    settings.rules[i][j] = Math.random() * 2 - 1;
                }
            }
            console.log(JSON.stringify(settings.rules));
            flattenRules()
        }

        function flattenRules() {
            settings.rulesArray = []
            for (let i = 0; i < settings.colors.length; i++) {
                const ruleRow = []
                for (let j = 0; j < settings.colors.length; j++) {
                    ruleRow.push(settings.rules[settings.colors[i]][settings.colors[j]])
                }
                settings.rulesArray.push(ruleRow)
            }
        }


        // Initiate Random locations for Atoms ( used when atoms created )
        function randomX() {
            return Math.random() * (settings.dimensions - 100) + 50;
        };

        function randomY() {
            return Math.random() * (settings.dimensions - 100) + 50;
        };


        const sphereGeom = new THREE.SphereGeometry(2, 5, 5)
        const meshMaterials = settings.colors.map(color => new THREE.MeshBasicMaterial({
            color: color,
            side: THREE.DoubleSide
        }))
        /* Create an Atom - Use matrices for x4/5 performance improvement
        atom[0] = x
        atom[1] = y
        atom[2] = z
        atom[3] = ax
        atom[4] = ay
        atom[5] = az
        atom[6] = color (index)
        atom[6] = mesh
        */
        const create = (number, color) => {
            for (let i = 0; i < number; i++) {
                const atom = [randomX(), randomY(), randomX(), 0, 0, 0, color]
                const mesh = new THREE.Mesh(sphereGeom, meshMaterials[color]);
                mesh.position.set(atom[0], atom[1], atom[2])
                mesh.scale.set(settings.atoms.radius, settings.atoms.radius, settings.atoms.radius)
                settings.scene.atomsGroup.add(mesh)
                atom.push(mesh)
                atoms.push(atom)
            }
        };

        function randomAtoms(number_of_atoms_per_color, clear_previous) {
            if (clear_previous) {
                atoms.length = 0
                // Clear existing atoms
                while (settings.scene.atomsGroup.children.length) {
                    settings.scene.atomsGroup.remove(settings.scene.atomsGroup.children[0])
                }
            }
            for (let c = 0; c < settings.colors.length; c++) {
                create(number_of_atoms_per_color, c)
            }
        }


        // Params for click-based pulse event
        // var pulse = 0;
        // var pulse_x = 0,
        //     pulse_y = 0;


        var total_v; // global velocity as a estimate of on-screen activity

        // Apply Rules ( How atoms interact with each other )
        const applyRules = () => {
            total_v = 0.;
            // update velocity first
            for (var a of atoms) {
                let fx = 0;
                let fy = 0;
                let fz = 0;
                const r2 = settings.cutOff;
                for (var b of atoms) {
                    const g = settings.rulesArray[a[6]][b[6]];
                    const dx = a[0] - b[0];
                    const dy = a[1] - b[1];
                    const dz = a[2] - b[2];
                    if (dx !== 0 || dy !== 0 || dz !== 0) {
                        const d = dx * dx + dy * dy + dz * dz;
                        if (d < r2) {
                            const F = g / Math.sqrt(d);
                            fx += F * dx;
                            fy += F * dy;
                            fz += F * dz;

                            // Draw lines between atoms that are effecting each other.
                            if (settings.drawings.lines) DrawLineBetweenAtoms(a[0], a[1], b[0], b[1], settings.colors[b[4]]);
                        }
                    }
                }
                // if (pulse != 0) {
                //     const dx = a[0] - pulse_x;
                //     const dy = a[1] - pulse_y;
                //     const d = dx * dx + dy * dy;
                //     if (d > 0) {
                //         const F = 100. * pulse / (d * settings.time_scale);
                //         fx += F * dx;
                //         fy += F * dy;
                //     }
                // }
                const vmix = (1. - settings.viscosity);
                a[3] = a[3] * vmix + fx * settings.time_scale;
                a[4] = a[4] * vmix + fy * settings.time_scale;
                a[5] = a[5] * vmix + fz * settings.time_scale;
                // record typical activity, so that we can scale the
                // time_scale later accordingly
                total_v += Math.abs(a[3]);
                total_v += Math.abs(a[4]);
                total_v += Math.abs(a[5]);
            }
            // update positions now
            for (var a of atoms) {
                a[0] += a[3]
                a[1] += a[4]
                a[2] += a[5]

                // When Atoms touch or bypass canvas borders
                if (a[0] < 0) {
                    a[0] = -a[0];
                    a[3] *= -1;
                }
                if (a[0] >= settings.dimensions) {
                    a[0] = 2 * settings.dimensions - a[0];
                    a[3] *= -1;
                }
                if (a[1] < 0) {
                    a[1] = -a[1];
                    a[4] *= -1;
                }
                if (a[1] >= settings.dimensions) {
                    a[1] = 2 * settings.dimensions - a[1];
                    a[4] *= -1;
                }
                if (a[2] < 0) {
                    a[2] = -a[2];
                    a[5] *= -1;
                }
                if (a[2] >= settings.dimensions) {
                    a[2] = 2 * settings.dimensions - a[2];
                    a[5] *= -1;
                }
                a[7].position.set(a[0], a[1], a[2])
            }
            total_v /= atoms.length;
        };


        // Generate Rules
        randomRules()

        initialiseScene()

        // Generate Atoms
        const atoms = []
        randomAtoms(settings.atoms.count, true)

        setupGUI()
        settings.gui.open()

        console.log('settings', settings)
        // Update Frames
        var lastT = Date.now();
        update();

        function update() {
            // Apply Rules
            applyRules()

            // Draw Atoms
            settings.scene.controls.update()
            settings.scene.renderer.render(settings.scene.scene, settings.scene.camera)

            // Update Params
            // updateParams()


            requestAnimationFrame(update)
        }

        // post-frame stats and updates
        // function updateParams() {
        //     // record FPS
        //     var curT = Date.now();
        //     if (curT > lastT) {
        //         const new_fps = 1000. / (curT - lastT);
        //         settings.fps = Math.round(settings.fps * 0.8 + new_fps * 0.2)
        //         lastT = curT;
        //     }

        //     // adapt time_scale based on activity
        //     if (total_v > 30. && settings.time_scale > 5.) settings.time_scale /= 1.1;
        //     if (settings.time_scale < 0.9) settings.time_scale *= 1.01;
        //     if (settings.time_scale > 1.1) settings.time_scale /= 1.01;

        //     if (pulse > 0) pulse -= 1;
        // }