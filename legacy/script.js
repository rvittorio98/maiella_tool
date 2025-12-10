// Export popup logic
// This script enables the export popup overlay and handles export actions

document.addEventListener('DOMContentLoaded', function () {
  const exportBtn = document.getElementById('exportBtn');
  const exportOverlay = document.getElementById('exportOverlay');
  const exportPopup = document.getElementById('exportPopup');
  const exportPNG = document.getElementById('exportPNG');
  const exportSVG = document.getElementById('exportSVG');
  const closeExportPopup = document.getElementById('closeExportPopup');

  if (exportBtn && exportOverlay) {
    exportBtn.addEventListener('click', function () {
      exportOverlay.style.display = 'flex'; // <--- usa flex per centrare
    });
  }
  if (closeExportPopup) {
    closeExportPopup.addEventListener('click', function () {
      exportOverlay.style.display = 'none';
    });
  }
  if (exportPNG) {
    exportPNG.addEventListener('click', function () {
      exportOverlay.style.display = 'none';
      if (window.Sphere3D) window.Sphere3D.exportPNG();
    });
  }

});
