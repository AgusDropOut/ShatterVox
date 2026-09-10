import type { PlayerController } from "../core/PlayerController";


export interface IPlayerMode {
    onEnter(player: PlayerController): void;
    onExit(player: PlayerController): void;
    update(player: PlayerController, deltaTime: number): void;
    onLeftClickDown(player: PlayerController): Promise<void>;
    onLeftClickUp(player: PlayerController): void;
    onRightClickDown(player: PlayerController): void;
    onRightClickUp(player: PlayerController): void;
}