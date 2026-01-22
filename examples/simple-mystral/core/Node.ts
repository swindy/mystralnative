import { Transform } from '../math/Transform';

export type NodeInitState = 'pending' | 'initializing' | 'ready' | 'error';

export class Node {
  public transform: Transform;
  public name: string;
  public children: Node[] = [];
  public parent: Node | null = null;
  public visible: boolean = true;
  public renderOrder: number = 0;

  protected _initState: NodeInitState = 'ready';
  protected _needsUpdate: boolean = false;

  get initState(): NodeInitState {
    return this._initState;
  }

  get needsInit(): boolean {
    return this._initState === 'pending';
  }

  get needsUpdate(): boolean {
    return this._needsUpdate;
  }

  constructor(name: string = 'Node') {
    this.name = name;
    this.transform = new Transform();
  }

  addChild(child: Node) {
    if (child.parent) {
      child.parent.removeChild(child);
    }
    child.parent = this;
    this.children.push(child);
    this.transform.addChild(child.transform);
  }

  removeChild(child: Node) {
    const index = this.children.indexOf(child);
    if (index !== -1) {
      this.children.splice(index, 1);
      child.parent = null;
      this.transform.removeChild(child.transform);
    }
  }

  traverse(callback: (node: Node) => unknown) {
    const result = callback(this);
    if (result === false) return;
    for (const child of this.children) {
      child.traverse(callback);
    }
  }
}
