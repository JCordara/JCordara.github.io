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
    camera: BABYLON.UniversalCamera;
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

        this.camera = new BABYLON.UniversalCamera("Camera", new vec3(0, 0, -100), this.scene);
        this.camera.fov = 0.1;

        this.globalLight = new BABYLON.DirectionalLight("GlobalLight", new vec3(-0.2, -0.2, 1), this.scene);
        this.globalLight.specular = new BABYLON.Color3(0, 0, 0);  // Remove specular from global dir light

        var chessPieceAtlasTexture = new BABYLON.Texture("./chesspieceatlas.png", this.scene);
        chessPieceAtlasTexture.updateSamplingMode(BABYLON.Texture.NEAREST_NEAREST);

        this.chessPieceAtlasMaterial = new BABYLON.StandardMaterial("Chess Piece Atlas Material", this.scene);
        this.chessPieceAtlasMaterial.diffuseTexture = chessPieceAtlasTexture;
        this.chessPieceAtlasMaterial.useAlphaFromDiffuseTexture = true;
        this.chessPieceAtlasMaterial.diffuseTexture.hasAlpha = true;

        // hide/show the Inspector when user presses 'i'
        window.addEventListener("keydown", (ev) => {
            if (ev.key === 'i') {
                if (this.scene.debugLayer.isVisible()) {
                    this.scene.debugLayer.hide();
                } else {
                    this.scene.debugLayer.show();
                }
            }
        });
    }

    public getMeshUnderCursor = (): BABYLON.Mesh | undefined => {
        var ray: BABYLON.Ray = this.scene.createPickingRay(this.scene.pointerX, this.scene.pointerY, BABYLON.Matrix.Identity(), this.camera);
        var hit: BABYLON.Nullable<BABYLON.PickingInfo> = this.scene.pickWithRay(ray, (m) => m.id != "0");
        return hit?.pickedMesh as BABYLON.Mesh | undefined;
    }

    public createPieceMesh = (piece: ChessPiece): BABYLON.Mesh => {
        const xMap = {
            [PieceType.Pawn]: 0,
            [PieceType.Knight]: 0.167,
            [PieceType.Bishop]: 0.333,
            [PieceType.Rook]: 0.5,
            [PieceType.Queen]: 0.667,
            [PieceType.King]: 0.833,
        };
        
        const y = piece.color == PieceColor.Light ? 0.5 : 0;
        const x = xMap[piece.type];
        const uv = new BABYLON.Vector4(x, y, x + 0.167, y + 0.5);
        const mesh = BABYLON.MeshBuilder.CreatePlane(
            piece.name, 
            {
                width: 0.9,
                height: 0.9,
                sideOrientation: BABYLON.Mesh.DOUBLESIDE,
                frontUVs: uv,
            },
            this.scene,
        );
        mesh.material = this.chessPieceAtlasMaterial;
        mesh.position = new vec3(piece.state.position.x - 3.5, piece.state.position.y - 3.5, 0.0);
        return mesh;
    }

    public createBoardSquareMesh = (color: PieceColor): BABYLON.Mesh => {
        const boardMaterial = new BABYLON.StandardMaterial("Board Material", this.scene);
        if (color == PieceColor.Dark) {
            boardMaterial.diffuseColor = new BABYLON.Color3(0.12, 0.35, 0.3);
        } else {
            boardMaterial.diffuseColor = new BABYLON.Color3(0.35, 0.55, 0.51);
        }
        // boardMaterial.diffuseTexture = new BABYLON.Texture("./board.png", this.scene);
        const boardMesh = BABYLON.MeshBuilder.CreatePlane(
            "Chess Board Square", {width: 1.0, height: 1.0}, this.scene
        );
        boardMesh.material = boardMaterial;
        // boardMesh.position = new vec3(0.0, 0.0, 0.01);
        return boardMesh;
    }
}

class PieceState {
    selected: boolean;
    position: vec2;

    // Only true on a pawn immediately after jumping 2 spaces from starting position
    enPassant: boolean;

    // True until first move
    notMoved: boolean;

    constructor(position?: vec2) {
        this.selected = false;
        this.position = position ?? new vec2(0, 0);
        this.enPassant = false;
        this.notMoved = true;
    }
}

enum PieceColor {
    Dark,
    Light,
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
    type: PieceType;
    color: PieceColor;
    name: string;
    mesh?: BABYLON.Mesh;
    state: PieceState;

    constructor(type: PieceType, color: PieceColor, position?: vec2) {
        this.color = color;
        this.type = type;
        this.name = `${PieceColor[this.color]} ${PieceType[this.type]}`
        this.state = new PieceState(position);
    }
}

class BoardSquare {
    occupant: ChessPiece | null;
    mesh?: BABYLON.Mesh;

    constructor () {
        this.occupant = null;
    }
}

class ChessBoard {
    squares: Array<Array<BoardSquare>>;

    constructor() {
        this.squares = new Array<Array<BoardSquare>>(8);
        for (let i = 0; i < 8; i++) {
            this.squares[i] = new Array<BoardSquare>(8);
            for (let j = 0; j < 8; j++) {
                this.squares[i][j] = new BoardSquare();
            }
        }
    }

    copyState(): ChessBoard {
        const other = new ChessBoard();
        for (let i = 0; i < 8; i++) {
            for (let j = 0; j < 8; j++) {
                other.squares[i][j].occupant = this.squares[i][j].occupant;
            }
        }
        return other;
    }
}

function isInCheck(board: ChessBoard, color: PieceColor): boolean {
    let kingPosition = new vec2(-1, -1);  // Initialize to garbagio
    for (let i = 0; i < 8; i++) {
        for (let j = 0; j < 8; j++) {
            if (board.squares[i][j].occupant != null 
                && board.squares[i][j].occupant!.color == color 
                && board.squares[i][j].occupant!.type == PieceType.King
            ) {
                kingPosition = new vec2(i, j);
            }
        }
    }

    if (kingPosition.equals(new vec2(-1, -1))) {
        return false;
    }

    for (let i = 0; i < 8; i++) {
        for (let j = 0; j < 8; j++) {
            if (board.squares[i][j].occupant != null && board.squares[i][j].occupant!.color != color) {
                // Useful values for movement checks
                const attacker = board.squares[i][j].occupant!;
                const difference = kingPosition.subtract(attacker.state.position);
                const positiveSlope = difference.y / difference.x > 0;
                const startFile = Math.min(attacker.state.position.x, kingPosition.x);
                const endFile = Math.max(attacker.state.position.x, kingPosition.x);
                const startRank = Math.min(attacker.state.position.y, kingPosition.y);
                const endRank = Math.max(attacker.state.position.y, kingPosition.y);

                switch (attacker.type) {

                    case PieceType.Pawn:
                        // Check if pawn is in an adjacent file
                        if (Math.abs(difference.x) == 1) {
                            const forward = (attacker.color == PieceColor.Light) ? 1 : -1;
                            if ((attacker.state.position.y + forward) == kingPosition.y) {
                                return true;
                            }
                        }
                        break;
                    
                    case PieceType.Knight:
                        if (Math.abs(difference.x) == 1 && Math.abs(difference.y) == 2) {
                            return true;
                        }
                        if (Math.abs(difference.x) == 2 && Math.abs(difference.y) == 1) {
                            return true;
                        }
                        break;
                    
                    case PieceType.Bishop:
                        if (Math.abs(difference.x)== Math.abs(difference.y)) {
                            let obstructed = false;
                            if (positiveSlope) {
                                let x = startFile + 1;
                                let y = startRank + 1;
                                while (x <= endFile - 1 && y <= endRank - 1) {
                                    if (board.squares[x][y].occupant != null) {
                                        obstructed = true;
                                        break;
                                    }
                                    x++;
                                    y++;
                                }
                            } else {
                                let x = startFile + 1;
                                let y = endRank - 1;
                                while (x <= endFile - 1 && y >= startRank + 1) {
                                    if (board.squares[x][y].occupant != null) {
                                        obstructed = true;
                                        break;
                                    }
                                    x++;
                                    y--;
                                }
                            }
                            
                            if (!obstructed) {
                                return true;
                            }
                        }
                        break;

                    case PieceType.Rook:
                        // Horizontal movement
                        if (difference.y == 0) {
                            let obstructed = false;
                            for (let x = startFile + 1; x <= endFile - 1; x++) {
                                if (board.squares[x][attacker.state.position.y].occupant != null) {
                                    obstructed = true;
                                    break;
                                }
                            }
                            if (!obstructed) {
                                return true;
                            }
                        }

                        // Vertical movement
                        if (difference.x == 0) {
                            let obstructed = false;
                            for (let y = startRank + 1; y <= endRank - 1; y++) {
                                if (board.squares[attacker.state.position.x][y].occupant != null) {
                                    obstructed = true;
                                    continue;
                                }
                            }
                            if (!obstructed) {
                                return true;
                            }
                        }
                        break;
                    
                    case PieceType.Queen:
                        // Diagonal movement
                        if (Math.abs(difference.x) == Math.abs(difference.y)) {
                            // Check squares along path for pieces
                            let obstructed = false;
                            if (positiveSlope) {
                                let x = startFile + 1;
                                let y = startRank + 1;
                                while (x <= endFile - 1 && y <= endRank - 1) {
                                    if (board.squares[x][y].occupant != null) {
                                        obstructed = true;
                                        break;
                                    }
                                    x++;
                                    y++;
                                }
                            } else {
                                let x = startFile + 1;
                                let y = endRank - 1;
                                while (x <= endFile - 1 && y >= startRank + 1) {
                                    if (board.squares[x][y].occupant != null) {
                                        obstructed = true;
                                        break;
                                    }
                                    x++;
                                    y--;
                                }
                            }

                            if (!obstructed) {
                                return true;
                            }
                        }
            
                        // Horizontal movement
                        if (difference.y == 0) {
                            let obstructed = false;
                            for (let x = startFile + 1; x <= endFile - 1; x++) {
                                if (board.squares[x][attacker.state.position.y].occupant != null) {
                                    obstructed = true;
                                    break;
                                }
                            }
                            if (!obstructed) {
                                return true;
                            }
                        }

                        // Vertical movement
                        if (difference.x == 0) {
                            let obstructed = false;
                            for (let y = startRank + 1; y <= endRank - 1; y++) {
                                if (board.squares[attacker.state.position.x][y].occupant != null) {
                                    obstructed = true;
                                    continue;
                                }
                            }
                            if (!obstructed) {
                                return true;
                            }
                        }
                        break;
                }
            }
        }
    }

    return false;
}

function isMoveLegal(board: ChessBoard, piece: ChessPiece, newLocation: vec2): boolean {
    console.log(`Validating move: ${PieceType[piece.type]} to ${String.fromCharCode('a'.charCodeAt(0) + newLocation.x)}${newLocation.y + 1}`);

    // Bounds check (cant move off board)
    if (newLocation.x > 8 || newLocation.x < 0 || newLocation.y > 8 || newLocation.y < 0) {
        return false;
    }

    // Disallow moving in-place
    if (piece.state.position.equals(newLocation)) {
        return false;
    }

    // Disallow taking your own pieces
    if (board.squares[newLocation.x][newLocation.y].occupant != null
        && board.squares[newLocation.x][newLocation.y].occupant!.color == piece.color
    ) {
        return false;
    }

    // Ensure that after this move, the player will not be in check
    // (regardless of how legal it is)
    const newBoardState = board.copyState();
    newBoardState.squares[piece.state.position.x][piece.state.position.y].occupant = null;
    newBoardState.squares[newLocation.x][newLocation.y].occupant = piece;
    if (isInCheck(newBoardState, piece.color)) {
        console.log("This move puts you in check");
        return false;
    }

    // Useful values for validity checks
    const difference = newLocation.subtract(piece.state.position);
    const positiveSlope = difference.y / difference.x > 0;
    const startFile = Math.min(piece.state.position.x, newLocation.x);
    const endFile = Math.max(piece.state.position.x, newLocation.x);
    const startRank = Math.min(piece.state.position.y, newLocation.y);
    const endRank = Math.max(piece.state.position.y, newLocation.y);

    // Validity checks per piece type
    switch (piece.type) {

        case PieceType.Pawn:
            if (piece.color == PieceColor.Light) {
                
                // Standard light pawn movement forward one to open square
                if (newLocation.equals(new vec2(piece.state.position.x, piece.state.position.y + 1))) {
                    if (board.squares[newLocation.x][newLocation.y].occupant == null) {
                        return true;
                    }
                }

                // Double-step light pawn movement (from starting position)
                if (piece.state.notMoved) {
                    if (newLocation.equals(new vec2(piece.state.position.x, piece.state.position.y + 2))) {
                        if (board.squares[newLocation.x][newLocation.y].occupant == null 
                            && board.squares[newLocation.x][newLocation.y - 1].occupant == null) 
                        {
                            return true;
                        }
                    }
                }

                // Light pawn capture
                if (newLocation.equals(new vec2(piece.state.position.x + 1, piece.state.position.y + 1))
                    || newLocation.equals(new vec2(piece.state.position.x - 1, piece.state.position.y + 1))) 
                {
                    if (board.squares[newLocation.x][newLocation.y].occupant != null ) {
                        return true;
                    }
                    
                    // Light pawn en passant
                    if (board.squares[newLocation.x][newLocation.y - 1].occupant != null) {
                        if (board.squares[newLocation.x][newLocation.y - 1].occupant!.state.enPassant
                            && board.squares[newLocation.x][newLocation.y - 1].occupant!.color != piece.color
                        ) {
                            return true;
                        }
                    }
                }

            } else {

                // Standard dark pawn movement forward one to open square
                if (newLocation.equals(new vec2(piece.state.position.x, piece.state.position.y - 1))) {
                    if (board.squares[newLocation.x][newLocation.y].occupant == null) {
                        return true;
                    }
                }

                // Double-step dark pawn movement (from starting position)
                if (piece.state.notMoved) {
                    if (newLocation.equals(new vec2(piece.state.position.x, piece.state.position.y - 2))) {
                        if (board.squares[newLocation.x][newLocation.y].occupant == null 
                            && board.squares[newLocation.x][newLocation.y - 1].occupant == null) 
                        {
                            return true;
                        }
                    }
                }

                // Dark pawn capture
                if (newLocation.equals(new vec2(piece.state.position.x + 1, piece.state.position.y - 1))
                    || newLocation.equals(new vec2(piece.state.position.x - 1, piece.state.position.y - 1))) 
                {
                    if (board.squares[newLocation.x][newLocation.y].occupant != null ) {
                        return true;
                    }
                    
                    // Dark pawn en passant
                    if (board.squares[newLocation.x][newLocation.y + 1].occupant != null) {
                        if (board.squares[newLocation.x][newLocation.y + 1].occupant!.state.enPassant
                            && board.squares[newLocation.x][newLocation.y + 1].occupant!.color != piece.color
                        ) {
                            return true;
                        }
                    }
                }

            }
            break;

        case PieceType.Knight:
            // Just make sure its moving 2 squares in one direction and 1 in the other
            if (Math.abs(difference.x) == 1 && Math.abs(difference.y) == 2
                || Math.abs(difference.x) == 2 && Math.abs(difference.y) == 1) 
            {
                return true;
            }
            break;
        
        case PieceType.Bishop:
            // Diagonal movement
            if (Math.abs(difference.x) == Math.abs(difference.y)) {
                // Check squares along path for pieces
                if (positiveSlope) {
                    let x = startFile + 1;
                    let y = startRank + 1;
                    while (x <= endFile - 1 && y <= endRank - 1) {
                        if (board.squares[x][y].occupant != null) {
                            return false;
                        }
                        x++;
                        y++;
                    }
                } else {
                    let x = startFile + 1;
                    let y = endRank - 1;
                    while (x <= endFile - 1 && y >= startRank + 1) {
                        if (board.squares[x][y].occupant != null) {
                            return false;
                        }
                        x++;
                        y--;
                    }
                }
                return true;
            }
            break;

        case PieceType.Rook:

            // Horizontal movement
            if (difference.y == 0) {
                for (let x = startFile + 1; x <= endFile - 1; x++) {
                    if (board.squares[x][piece.state.position.y].occupant != null) {
                        return false;
                    }
                }
                return true;
            }

            // Vertical movement
            if (difference.x == 0) {
                for (let y = startRank + 1; y <= endRank - 1; y++) {
                    if (board.squares[piece.state.position.x][y].occupant != null) {
                        return false;
                    }
                }
                return true;
            }

            break;
        
        case PieceType.Queen:

            // Diagonal movement
            if (Math.abs(difference.x) == Math.abs(difference.y)) {
                // Check squares along path for pieces
                if (positiveSlope) {
                    let x = startFile + 1;
                    let y = startRank + 1;
                    while (x <= endFile - 1 && y <= endRank - 1) {
                        if (board.squares[x][y].occupant != null) {
                            return false;
                        }
                        x++;
                        y++;
                    }
                } else {
                    let x = startFile + 1;
                    let y = endRank - 1;
                    while (x <= endFile - 1 && y >= startRank + 1) {
                        if (board.squares[x][y].occupant != null) {
                            return false;
                        }
                        x++;
                        y--;
                    }
                }
                return true;
            }

            // Horizontal movement
            if (difference.y == 0) {
                for (let x = startFile + 1; x <= endFile - 1; x++) {
                    if (board.squares[x][piece.state.position.y].occupant != null) {
                        return false;
                    }
                }
                return true;
            }

            // Vertical movement
            if (difference.x == 0) {
                for (let y = startRank + 1; y <= endRank - 1; y++) {
                    if (board.squares[piece.state.position.x][y].occupant != null) {
                        return false;
                    }
                }
                return true;
            }
            break;
        
        case PieceType.King:
            // Regular king movement
            if (Math.abs(difference.x) <= 1 && Math.abs(difference.y) <= 1) {
                return true;
            }

            // Castling
            if (difference.y == 0 && Math.abs(difference.x) == 2) {
                if (piece.state.notMoved) {
                    const longCastle = difference.x < 0;

                    // Check to see if king passes through check
                    let midCastleState = board.copyState();
                    midCastleState.squares[piece.state.position.x][piece.state.position.y].occupant = null;
                    midCastleState.squares[piece.state.position.x + (longCastle ? -1 : 1)][piece.state.position.y].occupant = piece;
                    if (isInCheck(midCastleState, piece.color)) {
                        return false;
                    }

                    // Check that movement is not obstructed
                    if (board.squares[piece.state.position.x + (longCastle ? -1 : 1)][piece.state.position.y].occupant != null) {
                        return false;
                    }

                    // Check that rook is present and hasn't moved
                    if (board.squares[longCastle ? 0 : 7][piece.state.position.y].occupant != null
                        && board.squares[longCastle ? 0 : 7][piece.state.position.y].occupant!.type == PieceType.Rook
                        && board.squares[longCastle ? 0 : 7][piece.state.position.y].occupant!.state.notMoved == true
                    ) {
                        return true;
                    }
                }
            }
            break;
    }

    return false;
}

class App {
    renderingManager: RenderingManager;
    board: ChessBoard;
    selectedPiece: ChessPiece | null;
    draggingPiece: boolean;
    pointerIxnPlane?: BABYLON.Mesh;
    pointerIxnPlaneMat: BABYLON.StandardMaterial;

    constructor() {
        this.renderingManager = new RenderingManager();
        this.board = this.createChessBoard();
        this.initializePieces();
        this.pointerIxnPlaneMat = new BABYLON.StandardMaterial("Pointer Intersection Plane Material", this.renderingManager.scene);
        this.pointerIxnPlaneMat.alpha = 0.0;
        this.draggingPiece = false;
        this.selectedPiece = null;

        this.renderingManager.scene.onPointerDown = () => {
            const mesh = this.renderingManager.getMeshUnderCursor();
            this.selectedPiece = null;

            for (let i = 0; i < 8; i++) {
                for (let j = 0; j < 8; j++) {
                    const square = this.board.squares[i][j];
                    const occupant = square.occupant;
                    // If either a piece or square was clicked
                    if (square.mesh?.uniqueId == mesh?.uniqueId || occupant?.mesh?.uniqueId == mesh?.uniqueId) {
                        // If occupant of the square (or square that clicked piece was on) is not null
                        if (occupant != undefined) {
                            this.selectedPiece = square.occupant;
                        }
                    }
                }
            }

            if (this.selectedPiece == null){
                return;
            }

            if (this.selectedPiece.mesh != undefined) {
                this.createPointerIxnPlane(this.selectedPiece?.mesh?.position);
                this.draggingPiece = true;
            }
        }

        this.renderingManager.scene.onPointerUp = () => {
            if (this.pointerIxnPlane != undefined) {
                this.renderingManager.scene.removeMesh(this.pointerIxnPlane);
            }
            if (this.draggingPiece) {
                this.draggingPiece = false;
                this.onPiecePlaced();
            }
        }
    }

    private getBoardCoordsUnderPointer(): vec2 | undefined {
        var ray: BABYLON.Ray = this.renderingManager.scene.createPickingRay(
            this.renderingManager.scene.pointerX, 
            this.renderingManager.scene.pointerY, 
            BABYLON.Matrix.Identity(), 
            this.renderingManager.camera,
        );
        var hit: BABYLON.Nullable<BABYLON.PickingInfo> = this.renderingManager.scene.pickWithRay(
            ray,
            (mesh: BABYLON.AbstractMesh) => mesh.name == "Chess Board Square",
            true,
        );
        
        if (!hit?.hit) {
            return;
        }

        // find x,y of square on board
        for (let i = 0; i < 8; i++) {
            for (let j = 0; j < 8; j++) {
                if (this.board.squares[i][j].mesh!.uniqueId == hit.pickedMesh!.uniqueId) {
                    return new vec2(i, j);
                }
            }
        }
    }

    private onPiecePlaced() {
        if (this.selectedPiece == null) {
            return;
        }

        const coords = this.getBoardCoordsUnderPointer();
        if (coords == undefined) {
            return;
        }

        if (isMoveLegal(this.board, this.selectedPiece, coords)) {
            console.log("legal move!");
            const oldPosition = this.selectedPiece.state.position;
            
            // Remove any piece currently on the destination square
            const oldOccupant = this.board.squares[coords.x][coords.y].occupant;
            if (oldOccupant != null) {
                this.renderingManager.scene.removeMesh(oldOccupant.mesh!);
            }

            // Remove pawn in case of en passant
            const behind = this.selectedPiece.color == PieceColor.Light ? -1 : 1;
            if (this.selectedPiece.type == PieceType.Pawn 
                && this.board.squares[coords.x][coords.y + behind].occupant
                && this.board.squares[coords.x][coords.y + behind].occupant!.color != this.selectedPiece.color
                && this.board.squares[coords.x][coords.y + behind].occupant!.state.enPassant) 
            {
                this.renderingManager.scene.removeMesh(this.board.squares[coords.x][coords.y + behind].occupant!.mesh!);
                this.board.squares[coords.x][coords.y + behind].occupant = null;
            }

            // Update en passant status
            for (let i = 0; i < 8; i++) {
                for (let j = 0; j < 8; j++) {
                    if (this.board.squares[i][j].occupant != null) {
                        // Remove any existing en passant status
                        this.board.squares[i][j].occupant!.state.enPassant = false;
                    }
                }
            }
            if (this.selectedPiece.type == PieceType.Pawn && Math.abs(oldPosition.y - coords.y) == 2) {
                // Add en passant status to this pawn until next turn
                this.selectedPiece.state.enPassant = true;
            }

            // Handle rook movement when castling
            if (this.selectedPiece.type == PieceType.King && Math.abs(coords.x - oldPosition.x) == 2) {
                const longCastle = (coords.x - oldPosition.x) < 0;
                const rookPosition = new vec2(longCastle ? 0 : 7, this.selectedPiece.state.position.y);
                const newPosition = new vec2(
                    longCastle ? this.selectedPiece.state.position.x - 1 : this.selectedPiece.state.position.x + 1, 
                    this.selectedPiece.state.position.y
                );
                this.board.squares[newPosition.x][newPosition.y].occupant = this.board.squares[rookPosition.x][rookPosition.y].occupant;
                this.board.squares[rookPosition.x][rookPosition.y].occupant = null;
                this.board.squares[newPosition.x][newPosition.y].occupant!.state.position = newPosition;
                this.board.squares[newPosition.x][newPosition.y].occupant!.state.notMoved = false;
            }
            
            // Update piece position
            this.board.squares[oldPosition.x][oldPosition.y].occupant = null;
            this.board.squares[coords.x][coords.y].occupant = this.selectedPiece;
            this.selectedPiece.state.position = coords;
            this.selectedPiece.state.notMoved = false;
        }
        else console.log("illegal move!");
    }

    public createChessPiece(type: PieceType, color: PieceColor, position?: vec2): ChessPiece {
        const newPiece = new ChessPiece(type, color, position);
        newPiece.mesh = this.renderingManager.createPieceMesh(newPiece);
        return newPiece;
    }

    public createChessBoard(): ChessBoard {
        const board = new ChessBoard();
        board.squares.forEach((row, i) => {
            row.forEach((square, j) => {
                if ((i + j) % 2 == 0) {
                    square.mesh = this.renderingManager.createBoardSquareMesh(PieceColor.Light);
                } else {
                    square.mesh = this.renderingManager.createBoardSquareMesh(PieceColor.Dark);
                }
                square.mesh!.position = new vec3(i-3.5, j-3.5, 0.01);
            });
        });
        return board;
    }

    public initializePieces() {
        // this.board.clear();
        
        // Light starting pieces
        for (let i = 0; i < 8; i++) {
            this.board.squares[i][1].occupant = this.createChessPiece(PieceType.Pawn, PieceColor.Light, new vec2(i, 1));
        }
    
        this.board.squares[0][0].occupant = this.createChessPiece(PieceType.Rook, PieceColor.Light, new vec2(0, 0));
        this.board.squares[1][0].occupant = this.createChessPiece(PieceType.Knight, PieceColor.Light, new vec2(1, 0));
        this.board.squares[2][0].occupant = this.createChessPiece(PieceType.Bishop, PieceColor.Light, new vec2(2, 0));
        this.board.squares[3][0].occupant = this.createChessPiece(PieceType.Queen, PieceColor.Light, new vec2(3, 0));
        this.board.squares[4][0].occupant = this.createChessPiece(PieceType.King, PieceColor.Light, new vec2(4, 0));
        this.board.squares[5][0].occupant = this.createChessPiece(PieceType.Bishop, PieceColor.Light, new vec2(5, 0));
        this.board.squares[6][0].occupant = this.createChessPiece(PieceType.Knight, PieceColor.Light, new vec2(6, 0));
        this.board.squares[7][0].occupant = this.createChessPiece(PieceType.Rook, PieceColor.Light, new vec2(7, 0));
        
        // Dark starting pieces
        for (let i = 0; i < 8; i++) {
            this.board.squares[i][6].occupant = this.createChessPiece(PieceType.Pawn, PieceColor.Dark, new vec2(i, 6));
        }
        
        this.board.squares[0][7].occupant = this.createChessPiece(PieceType.Rook, PieceColor.Dark, new vec2(0, 7));
        this.board.squares[1][7].occupant = this.createChessPiece(PieceType.Knight, PieceColor.Dark, new vec2(1, 7));
        this.board.squares[2][7].occupant = this.createChessPiece(PieceType.Bishop, PieceColor.Dark, new vec2(2, 7));
        this.board.squares[3][7].occupant = this.createChessPiece(PieceType.Queen, PieceColor.Dark, new vec2(3, 7));
        this.board.squares[4][7].occupant = this.createChessPiece(PieceType.King, PieceColor.Dark, new vec2(4, 7));
        this.board.squares[5][7].occupant = this.createChessPiece(PieceType.Bishop, PieceColor.Dark, new vec2(5, 7));
        this.board.squares[6][7].occupant = this.createChessPiece(PieceType.Knight, PieceColor.Dark, new vec2(6, 7));
        this.board.squares[7][7].occupant = this.createChessPiece(PieceType.Rook, PieceColor.Dark, new vec2(7, 7));
    }

    public isPieceSelected(piece: ChessPiece): boolean {
        return (this.selectedPiece == piece);
    }

    private createPointerIxnPlane(position: vec3) {
        this.pointerIxnPlane = BABYLON.MeshBuilder.CreatePlane(
            "Pointer Intersection Plane", 
            {width: 100.0, height: 100.0}, 
            this.renderingManager.scene,
        );
        this.pointerIxnPlane.material = this.pointerIxnPlaneMat;
        this.pointerIxnPlane.position = position;
        this.pointerIxnPlane.position.z -= 5.0;
    }

    private getPointerTarget(): vec3 {
        var ray: BABYLON.Ray = this.renderingManager.scene.createPickingRay(
            this.renderingManager.scene.pointerX, 
            this.renderingManager.scene.pointerY, 
            BABYLON.Matrix.Identity(), 
            this.renderingManager.camera,
        );
        var hit: BABYLON.Nullable<BABYLON.PickingInfo> = this.renderingManager.scene.pickWithRay(
            ray,
            (mesh: BABYLON.AbstractMesh) => {
                if (this.pointerIxnPlane != undefined && mesh.id == this.pointerIxnPlane.id) {
                    return true;
                }
                return false;
            },
            true,
        );
        return hit?.pickedPoint ?? new vec3(0.0, 0.0, 0.0);
    }

    public run() {
        this.renderingManager.engine.runRenderLoop(() => {
            // Update all piece positions
            for (let x = 0; x < 8; x++) {
                for (let y = 0; y < 8; y++) {
                    if (this.board.squares[x][y].occupant != null)
                        this.board.squares[x][y].occupant!.mesh!.metadata = {"State": this.board.squares[x][y].occupant?.state}; //tmp
                    if (this.board.squares[x][y].occupant != null) {
                        const piece = this.board.squares[x][y].occupant!;
                        // this.board.squares[x][y].occupant!.state.position = new vec2(x, y);
                        this.board.squares[x][y].occupant!.mesh!.position = new vec3(
                            piece.state.position.x - 3.5, 
                            piece.state.position.y - 3.5, 
                            0.0,
                        );
                    }
                }
            }

            // Move selected piece with mouse
            if (this.selectedPiece && this.draggingPiece) {
                this.selectedPiece!.mesh!.position = this.getPointerTarget();
            }

            // Render the scene
            this.renderingManager.scene.render();
        });
    }
}

const app = new App();
app.run();
