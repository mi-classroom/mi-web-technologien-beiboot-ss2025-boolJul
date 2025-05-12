document.addEventListener("DOMContentLoaded", () => {
    const dropZone = document.getElementById("drop-zone");
    const imageInput = document.getElementById("imageInput");
    const gallery = document.getElementById("gallery");
    const previewImage = document.getElementById("preview-image");

    const metadataTable = document.querySelector(".metadata-table");

    dropZone.addEventListener("dragover", (e) => {
        e.preventDefault();
        dropZone.style.borderColor = "#007d7d";
    });

    dropZone.addEventListener("dragleave", () => {
        dropZone.style.borderColor = "#2ABDBD";
    });

    dropZone.addEventListener("drop", (e) => {
        e.preventDefault();
        dropZone.style.borderColor = "#2ABDBD";
        handleFiles(e.dataTransfer.files);
    });

    imageInput.addEventListener("change", (e) => {
        handleFiles(e.target.files);
    });

    async function handleFiles(fileList) {
        const formData = new FormData();
        for (let file of fileList) {
            formData.append("images", file);
        }

        await fetch("/upload", {
            method: "POST",
            body: formData,
        });

        imageInput.value = "";
        loadGallery();
    }

    async function loadGallery() {
        gallery.innerHTML = "";
        const res = await fetch("/api/images");
        const files = await res.json();

        files.forEach((filename) => {
            const item = document.createElement("div");
            item.className = "gallery-item";

            const img = document.createElement("img");
            img.src = `/uploads/${filename}`;
            img.alt = filename;
            img.addEventListener("click", () => {
                previewImage.src = `/uploads/${filename}`;
                loadMetadata(filename);
            });

            const textBlock = document.createElement("div");
            textBlock.className = "gallery-text";

            const fileNameEl = document.createElement("div");
            fileNameEl.className = "filename";
            fileNameEl.textContent = filename;

            const dateEl = document.createElement("div");
            dateEl.className = "date";
            const created = new Date();
            dateEl.textContent = created.toLocaleDateString("de-DE");

            textBlock.appendChild(fileNameEl);
            textBlock.appendChild(dateEl);

            const delBtn = document.createElement("button");
            delBtn.innerHTML = "Delete";
            delBtn.onclick = async () => {
                await fetch(`/api/images/${filename}`, { method: "DELETE" });
                loadGallery();
            };

            item.appendChild(img);
            item.appendChild(textBlock);
            item.appendChild(delBtn);

            gallery.appendChild(item);
        });
    }

    async function loadMetadata(filename) {
        const res = await fetch(`/api/metadata/${filename}`);
        const result = await res.json();
        const data = result.data || {};

        metadataTable.innerHTML = "";
        Object.entries(data).forEach(([key, value]) => {
            const row = document.createElement("tr");
            const keyCell = document.createElement("td");
            keyCell.textContent = key;
            const valueCell = document.createElement("td");
            valueCell.textContent = value;
            row.appendChild(keyCell);
            row.appendChild(valueCell);
            metadataTable.appendChild(row);
        });
    }

    loadGallery();
});
