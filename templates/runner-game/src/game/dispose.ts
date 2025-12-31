import * as THREE from "three";

function disposeMaterial(material: THREE.Material) {
  for (const value of Object.values(material)) {
    if (value && typeof value === "object" && value instanceof THREE.Texture) value.dispose();
  }
  material.dispose();
}

export function disposeObject3D(root: THREE.Object3D) {
  root.traverse((obj: THREE.Object3D) => {
    const mesh = obj as THREE.Mesh;
    if (!("isMesh" in mesh) || !mesh.isMesh) return;

    mesh.geometry?.dispose?.();

    const { material } = mesh;
    if (Array.isArray(material)) material.forEach(disposeMaterial);
    else if (material) disposeMaterial(material);
  });
}
