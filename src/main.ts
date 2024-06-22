import "@babylonjs/core/Debug/debugLayer";
import "@babylonjs/inspector";
import * as BABYLON from "@babylonjs/core";
import {
    Vector3 as vec3, 
    Vector2 as vec2,
} from "@babylonjs/core";


class RenderingManager {
    canvas: HTMLCanvasElement;
    engine: BABYLON.Engine;
    scene: BABYLON.Scene;
    globalLight: BABYLON.DirectionalLight;
    chessPieceAtlasMaterial: BABYLON.StandardMaterial;

    constructor() {
        this.canvas = document.createElement("canvas");
        this.canvas.style.width = "100%";
        this.canvas.style.height = "100%";
        this.canvas.id = "gameCanvas";
        document.body.appendChild(this.canvas);

        this.engine = new BABYLON.Engine(this.canvas, true, {
            adaptToDeviceRatio: true,
        });
        
        this.scene = new BABYLON.Scene(this.engine);

        var camera: BABYLON.UniversalCamera = new BABYLON.UniversalCamera("Camera", new vec3(0, 0, -100), this.scene);
        camera.fov = 0.1;

        this.globalLight = new BABYLON.DirectionalLight("GlobalLight", new vec3(-0.2, -0.2, 1), this.scene);
        this.globalLight.specular = new BABYLON.Color3(0, 0, 0);  // Remove specular from global dir light

        var chessPieceAtlasTexture = new BABYLON.Texture("./chesspieceatlas.png", this.scene);
        chessPieceAtlasTexture.updateSamplingMode(BABYLON.Texture.NEAREST_NEAREST);

        this.chessPieceAtlasMaterial = new BABYLON.StandardMaterial("Chess Piece Atlas Material", this.scene);
        this.chessPieceAtlasMaterial.diffuseTexture = chessPieceAtlasTexture;
        this.chessPieceAtlasMaterial.useAlphaFromDiffuseTexture = true;
        this.chessPieceAtlasMaterial.diffuseTexture.hasAlpha = true;

        // var board : BABYLON.Mesh = BABYLON.MeshBuilder.CreatePlane("board", {height: 10, width: 10}, this.scene);
        // board.position = new vec3(0, 0, 2);

        // hide/show the Inspector
        window.addEventListener("keydown", (ev) => {
            // Shift+Ctrl+Alt+I
            if (ev.key === 'i') {
                if (this.scene.debugLayer.isVisible()) {
                    this.scene.debugLayer.hide();
                } else {
                    this.scene.debugLayer.show();
                }
            }
        });

        // this.scene.onPointerDown = function castRay() {
        //     var ray: BABYLON.Ray = this.scene.createPickingRay(this.scene.pointerX, this.scene.pointerY, BABYLON.Matrix.Identity(), camera);

        //     var hit: BABYLON.PickingInfo = this.scene.pickWithRay(ray);
        //     if (hit.hit) {
        //         hit.pickedMesh.parent;
        //         console.log(hit.pickedMesh.name);
        //     }
        // }
    }

    public renderLoop() {
        this.engine.runRenderLoop(() => {
            this.scene.render();
        });
    }

    createPieceMesh = (piece: ChessPiece): BABYLON.Mesh => {
        const xMap = {
            [PieceType.Pawn]: 0,
            [PieceType.Knight]: 0.167,
            [PieceType.Bishop]: 0.333,
            [PieceType.Rook]: 0.5,
            [PieceType.Queen]: 0.667,
            [PieceType.King]: 0.833,
        };
        
        const y = piece.color == PieceColor.White ? 0.5 : 0;
        const x = xMap[piece.type];
        const uv = new BABYLON.Vector4(x, y, x + 0.167, y + 0.5);
        const mesh = BABYLON.MeshBuilder.CreatePlane(
            `${PieceColor[piece.color]} ${PieceType[piece.type]}`, 
            {
                width: 0.9,
                height: 0.9,
                sideOrientation: BABYLON.Mesh.DOUBLESIDE,
                frontUVs: uv,
            },
            this.scene,
        );
        mesh.material = this.chessPieceAtlasMaterial;
        mesh.position = new vec3(piece.position.x - 3.5, piece.position.y - 3.5, 0.0);
        return mesh;
    }

    public createChessBoard() {
        const boardMaterial = new BABYLON.StandardMaterial("Board Material", this.scene);
        boardMaterial.diffuseTexture = new BABYLON.Texture("./board.png", this.scene);
        const boardMesh = BABYLON.MeshBuilder.CreatePlane(
            "Chess Board", {width: 8.1, height: 8.1}, this.scene
        );
        boardMesh.material = boardMaterial;
        boardMesh.position = new vec3(0.0, 0.0, 1.0);
    }
}


enum PieceColor {
    Black,
    White,
}

enum PieceType {
    Pawn,
    Knight,
    Bishop,
    Rook,
    Queen, 
    King,
}

class ChessPiece {
    position: vec2;
    type: PieceType;
    color: PieceColor;
    mesh?: BABYLON.Mesh;
    name: string;

    constructor(type: PieceType, color: PieceColor, position?: vec2) {
        this.color = color;
        this.type = type;
        this.position = position ?? new vec2(0, 0);
        this.mesh = undefined;
        this.name = `${PieceColor[this.color]} ${PieceType[this.type]}`
    }
}




class App {
    renderingManager: RenderingManager;

    constructor() {
        this.renderingManager = new RenderingManager();
    }

    public createChessPiece(type: PieceType, color: PieceColor, position?: vec2): ChessPiece {
        const newPiece = new ChessPiece(type, color, position);
        newPiece.mesh = this.renderingManager.createPieceMesh(newPiece);
        return newPiece;
    }

    public run() {
        this.renderingManager.renderLoop();
    }
}

const app = new App();

app.renderingManager.createChessBoard();

const whitePawns = [
    app.createChessPiece(PieceType.Pawn, PieceColor.White, new vec2(0, 1)),
    app.createChessPiece(PieceType.Pawn, PieceColor.White, new vec2(1, 1)),
    app.createChessPiece(PieceType.Pawn, PieceColor.White, new vec2(2, 1)),
    app.createChessPiece(PieceType.Pawn, PieceColor.White, new vec2(3, 1)),
    app.createChessPiece(PieceType.Pawn, PieceColor.White, new vec2(4, 1)),
    app.createChessPiece(PieceType.Pawn, PieceColor.White, new vec2(5, 1)),
    app.createChessPiece(PieceType.Pawn, PieceColor.White, new vec2(6, 1)),
    app.createChessPiece(PieceType.Pawn, PieceColor.White, new vec2(7, 1)),
];

const whiteKnights = [
    app.createChessPiece(PieceType.Knight, PieceColor.White, new vec2(1, 0)),
    app.createChessPiece(PieceType.Knight, PieceColor.White, new vec2(6, 0)),
];

const whiteBishops = [
    app.createChessPiece(PieceType.Bishop, PieceColor.White, new vec2(2, 0)),
    app.createChessPiece(PieceType.Bishop, PieceColor.White, new vec2(5, 0)),
];

const whiteRooks = [
    app.createChessPiece(PieceType.Rook, PieceColor.White, new vec2(0, 0)),
    app.createChessPiece(PieceType.Rook, PieceColor.White, new vec2(7, 0)),
];

const whiteQueen = app.createChessPiece(PieceType.Queen, PieceColor.White, new vec2(3, 0));

const whiteKing = app.createChessPiece(PieceType.King, PieceColor.White, new vec2(4, 0));


const blackPawns = [
    app.createChessPiece(PieceType.Pawn, PieceColor.Black, new vec2(0, 6)),
    app.createChessPiece(PieceType.Pawn, PieceColor.Black, new vec2(1, 6)),
    app.createChessPiece(PieceType.Pawn, PieceColor.Black, new vec2(2, 6)),
    app.createChessPiece(PieceType.Pawn, PieceColor.Black, new vec2(3, 6)),
    app.createChessPiece(PieceType.Pawn, PieceColor.Black, new vec2(4, 6)),
    app.createChessPiece(PieceType.Pawn, PieceColor.Black, new vec2(5, 6)),
    app.createChessPiece(PieceType.Pawn, PieceColor.Black, new vec2(6, 6)),
    app.createChessPiece(PieceType.Pawn, PieceColor.Black, new vec2(7, 6)),
];
    
const blackKnights = [
    app.createChessPiece(PieceType.Knight, PieceColor.Black, new vec2(1, 7)),
    app.createChessPiece(PieceType.Knight, PieceColor.Black, new vec2(6, 7)),
];

const blackBishops = [
    app.createChessPiece(PieceType.Bishop, PieceColor.Black, new vec2(2, 7)),
    app.createChessPiece(PieceType.Bishop, PieceColor.Black, new vec2(5, 7)),
];

const blackRooks = [
    app.createChessPiece(PieceType.Rook, PieceColor.Black, new vec2(0, 7)),
    app.createChessPiece(PieceType.Rook, PieceColor.Black, new vec2(7, 7)),
];

const blackQueen = app.createChessPiece(PieceType.Queen, PieceColor.Black, new vec2(3, 7));

const blackKing = app.createChessPiece(PieceType.King, PieceColor.Black, new vec2(4, 7));

console.log(whitePawns, whiteKnights, whiteBishops, whiteRooks, whiteQueen, whiteKing)
console.log(blackPawns, blackKnights, blackBishops, blackRooks, blackQueen, blackKing)

app.run();
