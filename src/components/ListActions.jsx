import { useRef } from "react";

function ListActions({ onExport, onImport }) {
  const fileInputRef = useRef(null);

  function handleImport(e) {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();

    reader.onload = () => {
      try {
        onImport(JSON.parse(reader.result));
      } catch {
        alert("Invalid JSON file");
      }

      e.target.value = "";
    };

    reader.readAsText(file);
  }

  return (
    <div className="listActions">
      <button onClick={onExport}>Export JSON</button>
      <button onClick={() => fileInputRef.current.click()}>Import JSON</button>
      <input ref={fileInputRef} type="file" accept="application/json,.json" onChange={handleImport} hidden />
    </div>
  );
}

export default ListActions;