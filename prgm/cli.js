import {
    AsyncResource
} from 'async_hooks';

const arg = require('arg');
const fs = require('fs');
const shell = require('shelljs');
const appData = require('appdata-path');
const {
    exec
} = require('child_process');

const babelTemplate = {
    "plugins": [
        ["@babel/plugin-transform-react-jsx", {
            "pragma": "MiniFramework.createElement", // default pragma is React.createElement
            "throwIfNamespace": false // defaults to true
        }]
    ]
}

const frameworkTemplate = `
interface FrameworkEl extends JSX.Element {
    tag: any;
  }
  
  const MiniFramework = {
    createElement: (
      tag: JSX.Element,
      props: any,
      ...children: any[]
    ): FrameworkEl => {
      const element = {
        tag,
        type: tag.type,
        key: tag.key,
        props: { ...props, children },
      };
      return element;
    },
  };
  
  const render = (frameworkEl: FrameworkEl, container: Element | null) => {
    if (["string", "number"].includes(typeof frameworkEl)) {
      container?.appendChild(document.createTextNode(frameworkEl?.toString()));
      return;
    }
  
    const actualDOMElement = document.createElement(frameworkEl.tag);
  
    // Apply Props to actual DOM Element
    Object.keys(frameworkEl?.props)
      .filter((key) => key !== "children")
      .forEach((property) => {
        actualDOMElement[property] = frameworkEl.props[property];
      });
  
    // Render children inside this element
    frameworkEl?.props?.children.forEach((child: FrameworkEl) => {
      render(child, actualDOMElement);
    });
  
    container?.appendChild(actualDOMElement); // Happens once, unless the DOM already exists and we just need to replace something on the child element.
  };
  
  const myMarkup = () => {
    return (
      <div data-x="data attribute test">
        <div id="id-test">
          <h1>Mini Framework</h1>
          <input
            type="text"
            placeholder="Part 2: data binding & hooks coming soon"
          />
        </div>
      </div>
    );
  };
  
  render(myMarkup() as FrameworkEl, document.querySelector("#app"));
`

const indexHTML = `
<!DOCTYPE html>
<html lang="en">
    <head>
        <script type="module">
            import { add } from "./build/release.js";
            document.body.innerText = add(1, 2);
        </script>
    </head>
    <body>
        <div id="app"></div>
        <script src="./src/index.tsx"></script>
    </body>
</html>
`

const packageJsonTemplate = {
    "name": null,
    "version": "1.0.0",
    "description": "assemble project template",
    "scripts": {
        "install": "napa",
        "test": "node tests",
        "pack": "npx parcel ./index.html",
        "start": "npx serve .",
        "rust:build": "wasm-pack build rust/ --out-dir distDev/webassembly --debug",
        "rust:buildFinal": "wasm-pack build rust/ --out-dir dist/webassembly --release",
        "cpp:build": "emcc --bind -O3 src/cpp/main.cpp"
    },
    "engines": {
        "node": ">=16.0.0"
    },
    "napa": {
        "libvpx": "git+https://github.com/webmproject/libvpx"
    },
    "keywords": [
        "assemble",
        "webassembly"
    ],
    "author": "",
    "license": ""
}

function parseHtmlIndexReplace(key, addon) {
    var html = fs.readFileSync('./index.html', {
        encoding: 'utf-8',
        flag: 'r'
    });
    var newHtml = null;
    html.split(/\r?\n/).forEach((line, ind) => {
        if (line.includes(key)) {
            newHtml = newHtml + addon;
        } else {
            if (line != null) {
                newHtml = newHtml + line;
            }
        }
    });
}

function parseHtmlIndexAddAbove(key, addon) {
    var html = fs.readFileSync('./index.html', {
        encoding: 'utf-8',
        flag: 'r'
    });
    var newHtml = null;
    html.split(/\r?\n/).forEach((line, ind) => {
        if (line.includes(key)) {
            newHtml = newHtml + addon + line;
        } else {
            if (line != null) {
                newHtml = newHtml + line;
            }
        }
    });
}

function installEMCC() {
    var osValue = process.platform;
    if (osValue == 'win32') {
        console.log('WARNING: this is not as stable, but should still work.');
        let tmp = appData();
        let currentDir = process.cwd();

        shell.cd(tmp);
        shell.exec('git clone https://github.com/emscripten-core/emsdk.git');
        shell.cd('emsdk');
        shell.exec('start emsdk install latest');
        shell.exec('start emsdk activate latest');
        shell.exec('emsdk_env.bat');
        shell.cd(currentDir);

    }

    if (osValue == 'linux') {
        let tmp = shell.tempdir();
        let currentDir = process.cwd();

        if (!shell.which('python3')) {
            shell.exec('sudo apt-get install python3');
        }

        if (!shell.which('git')) {
            shell.exec('sudo apt-get install git');
        }

        if (!shell.which('cmake')) {
            shell.exec('sudo apt-get install cmake');
        }

        shell.cd(tmp);
        shell.exec('git clone https://github.com/emscripten-core/emsdk.git');
        shell.cd('emsdk');
        shell.exec('./emsdk install latest');
        shell.exec('./emsdk activate latest');
        shell.exec('source ./emsdk_env.sh');

        shell.cd(currentDir)
    }
}

function installRust() {
    //https://static.rust-lang.org/rustup/dist/x86_64-pc-windows-msvc/rustup-init.exe
    var osValue = process.platform;
    if (osValue == 'win32') {
        console.log('Right now you will need to install rust and web-pack manually for windows, we are working on this!');
        console.log('rust: https://static.rust-lang.org/rustup/dist/x86_64-pc-windows-msvc/rustup-init.exe');
        console.log('web-pack: https://github.com/rustwasm/wasm-pack/releases/download/v0.10.3/wasm-pack-init.exe')
        return;

        let url = "https://static.rust-lang.org/rustup/dist/x86_64-pc-windows-msvc/rustup-init.exe";
        //shell.exec('Invoke-WebRequest -URI "https://static.rust-lang.org/rustup/dist/x86_64-pc-windows-msvc/rustup-init.exe" -OutFile ".\\rust-install.exe" ')
        exec('Start-BitsTransfer -Source "' + url + '" -Destination rust-install.exe', {
            'shell': 'powershell.exe'
        }, (error, stdout, stderr) => {
            console.log(stdout);
        })
    }

    if (osValue == "linux") {
        if (!shell.which('curl')) {
            shell.exec('sudo apt-get curl');
        }

        shell.exec('curl --proto \'=https\' --tlsv1.2 -sSf https://sh.rustup.rs | sh');
        shell.exec('curl https://rustwasm.github.io/wasm-pack/installer/init.sh -sSf | sh');
    }
}

export function init(args) {
    function parseArgs(rawArgs) {
        const args = arg({
            "--help": Boolean,
            "--emcc": Boolean,
            "--rust": Boolean,
            "-h": "--help",
            "-e": "--emcc",
            "-r": "--rust"
        }, {
            argv: rawArgs.slice(2)
        });
        return {
            help: args['--help'] || false,
            emcc: args['--emcc'] || false,
            rust: args['--rust'] || false
        }
    }

    const argc = parseArgs(args);
    if (argc.help == true) {
        console.log('-e/--emcc -> install emscripten for C/C++ web assembly features');
        console.log('-r/--rust -> install rust and web-pack to compile rust into webassembly');
    } else {

        if (argc.emcc == true) {
            installEMCC();
        }

        if (argc.rust == true) {
            installRust();
        }
    }
}

export function assemble(args) {
    console.log('assemble-create-project -> create an assemble project');
    console.log('    -n/--name -> the name of the project');
    console.log('    -d/--dir -> where to create the project, directory wise. if not set it will set in current directory');
    console.log('');
    console.log('assemble-add-component -> create a tsx conponent for the assemble project');
    console.log('    -n/--name -> name of the component');
    console.log('');
    console.log('assemble-build -> build the assemble project');
    console.log('    -d/--debug -> build project in debug mode');
    console.log('    -r/--release -> build project in release mode');
}

export function createProject(args) {
    function parseArgs(rawArgs) {
        const args = arg({
            "--help": Boolean,
            "--name": String,
            "--dir": String,
            "-h": "--help",
            "-n": "--name",
            "-d": "--dir"
        }, {
            argv: rawArgs.slice(2)
        });
        return {
            help: args['--help'] || false,
            name: args['--name'] || 'assemble-project',
            dir: args['--dir'] || './'
        }
    }

    const argc = parseArgs(args);
    if (!shell.which('tsc')) {
        shell.exec('npm i -g typescript');
    }
    console.log('dir:', argc.dir);
    var dir = null;
    if (argc.dir == undefined) {
        dir = "./";
    } else {
        dir = argc.dir;
    }
    fs.mkdirSync(dir + argc.name);
    fs.writeFileSync(dir + argc.name + '/package.json', JSON.stringify(packageJsonTemplate));
    shell.cd(argc.dir);
    shell.cd(argc.name);

    shell.exec('npm i --save-dev assemblyscript');
    shell.exec('npx asinit . -y');
    shell.exec('npm i --save-dev @babel/core parcel napa typescript babel-plugin-closure-elimination');
    shell.exec('npm i @babel/plugin-transform-react-jsx');
    shell.exec('tsc --init');
    setTimeout(() => {
        fs.unlinkSync('index.html');
        fs.writeFileSync("index.html", indexHTML);
        fs.writeFileSync('.babelrc', JSON.stringify(babelTemplate));

        fs.mkdirSync('src');
        fs.mkdirSync('./src/components');


        fs.writeFileSync('./src/index.tsx', frameworkTemplate);
        fs.writeFileSync('./src/components/index.json', JSON.stringify({
            component: []
        }));
        fs.writeFileSync('./assembly/index.js', 'import { add } from "./debug.js";');
        fs.mkdirSync('./assembly/cpp');
        fs.mkdirSync('./assembly/rust');
        fs.mkdirSync('./assembly/cpp/src');
        fs.mkdirSync('./assembly/cpp/dist');
        fs.mkdirSync('./assembly/rust/src');
        fs.mkdirSync('./assembly/rust/dist');

        //import { add } from "./build/debug.js";
        //document.body.innerText = add(1, 2);

        var initHtml = fs.readFileSync('./index.html', {
            encoding: 'utf-8'
        });
        var newerHtml = null;
        initHtml.split(/\r?\n/).forEach((line, ind) => {

            if (!line.includes('import { add } from "./build/debug.js";') && !line.includes('document.body.innerText = add(1, 2);') && !line.includes('import { add } from "./build/release.js";')) {
                if(line != null) {
                    newerHtml = newerHtml + line + '\n';
                }
            }
        });

        fs.unlinkSync('./index.html');
        fs.writeFileSync('./index.html', newerHtml);
        newerHtml = null;
    }, 2000);

}

export function buildProject(args) {

    function parseArgs(rawArgs) {
        const args = arg({
            "--help": Boolean,
            "--debug": Boolean,
            "--release": Boolean,
            "--verbose": Boolean,
            "-v": "--verbose",
            "-h": "--help",
            "-d": "--debug",
            "-r": "--release"

        }, {
            argv: rawArgs.slice(2)
        });
        return {
            help: args['--help'] || false,
            debug: args['--debug'] || true,
            release: args['--release'] || false,
            verbose: args["--verbose"] || false
        }
    }

    const argc = parseArgs(args);

    if (argc.debug) {

        shell.exec('npm run asbuild:debug');

    } else {
        shell.exec('npm run asbuild:release');
    }
    let index = fs.readFileSync('./src/components/index.json', {
        encoding: 'utf-8',
        flag: 'r'
    });
    let json = JSON.parse(index);
    let html = fs.readFileSync('./index.html', {
        encoding: 'utf-8',
        flag: 'r'
    });
    let newHtml = null;

    json.component.forEach((ele) => {
        html.split(/\r?\n/).forEach((line, ind) => {
            if (line.includes('</body>')) {
                if (!html.includes('<script src="./src/components/' + ele.name + '/' + ele.name + '.component.tsx"></script>')) {
                    newHtml = newHtml + '<script src="./src/components/' + ele.name + '/' + ele.name + '.component.tsx"></script>' + '\n' + line;
                } else {
                    if(line != null){
                        newHtml = newHtml + line + '\n';
                    }
                }
            } else {

                    if (line != null) {
                        newHtml = newHtml + line + '\n';
                    }
                
            }
        });
    })

    if (argc.verbose) {
        newHtml.split(/\r?\n/).forEach((line, ind) => {
            console.log('newLine:', line);
        });
    }

    fs.unlinkSync('./index.html');
    fs.writeFileSync('./index.html', newHtml);
    newHtml = null;

    shell.exec('npx parcel build index.html');
    shell.cp('./assembly/index.js', './dist/assemblyScript.js');
    if (argc.debug) {
        shell.cp('./build/debug.js', './dist/debug.js');
        shell.cp('./build/debug.wasm', './dist/debug.wasm');


    } else {
        shell.cp('./build/release.js', './dist/release.js');
        shell.cp('./build/release.wasm', './dist/release.wasm');
    }

    html = fs.readFileSync('./dist/index.html', {
        encoding: 'utf-8',
        flag: 'r'
    });

    html.split(/\r?\n/).forEach((line, ind) => {
        if (line.includes('</head>')) {
            if (argc.debug) {
                if (!html.includes('<script src="./debug.js"></script>')) {
                    newHtml = newHtml + '<script src="./debug.js"></script>' + '\n' + line;
                } else {
                    if(line != null) {
                        newHtml = newHtml + line + '\n';
                    }
                }
            } else {
                if (!html.includes('<script src="./release.js"></script>')) {
                    newHtml = newHtml + '<script src="./release.js"></script>' + '\n' + line;
                } else {
                    if(line != null) {
                        newHtml = newHtml + line + '\n';
                    }
                }
            }
        } else {
            if (line.includes('</body>')) {
                if (!line.includes('<script src="./assemblyScript.js"></script>')) {
                    if (line != null) {
                        newHtml = newHtml + '<script src="./assemblyScript.js"></script>' + '\n' + line;
                    }
                }
            }
        }
    });

    shell.exec('npx parcel serve ./dist/index.html');
}

export function createComponent(args) {
    console.log('current dir', process.cwd())

    function parseArgs(rawArgs) {
        const args = arg({
            "--help": Boolean,
            "--name": String,
            "-h": "--help",
            "-n": "--name"
        }, {
            argv: rawArgs.slice(2)
        });
        return {
            help: args['--help'] || false,
            name: args['--name'] || 'component'
        }
    }

    const argc = parseArgs(args);

    shell.cd('./src/components');
    shell.mkdir(argc.name);
    fs.writeFileSync('./' + argc.name + '/' + argc.name + '.component.tsx', `
    const ` + argc.name + `Component = () =>{
        return(<div>component</div>)
    }

    render(` + argc.name + `Component() as FrameworkEl, document.querySelector("` + argc.name + `"))

    `);


    console.log('dir:', process.cwd())
    var comIndexData = fs.readFileSync('index.json', {
        encoding: 'utf-8'
    });
    console.log(comIndexData);
    var obj = JSON.parse(comIndexData);
    console.log(obj);
    obj.component.push({
        name: argc.name
    });
    fs.unlinkSync('index.json');
    fs.writeFileSync('index.json', JSON.stringify(obj));


}

export function addService(args) {
    function parseArgs(rawArgs) {
        const args = arg({
            "--help": Boolean,
            "--name": Boolean,
            "-h": "--help",
            "-n": "--name"
        }, {
            argv: rawArgs.slice(2)
        });
        return {
            help: args['--help'] || false,
            init: args['--name'] || false
        }
    }
}

export function addWasm(args) {
    function parseArgs(rawArgs) {
        const args = arg({
            "--help": Boolean,
            "--name": Boolean,
            "-h": "--help",
            "-n": "--name"
        }, {
            argv: rawArgs.slice(2)
        });
        return {
            help: args['--help'] || false,
            init: args['--name'] || false
        }
    }
}