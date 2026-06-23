<div class="eventostri-admin-v2">
  <section class="admin-v2-topbar">
    <div>
      <h2>Eventos</h2>
      <p>Calendario modificable</p>
    </div>
    <div class="admin-v2-actions">
      <button type="button" id="btnVerificarSesionV2" class="btn-secondary">Verificar sesion</button>
      <button type="button" id="btnCargarApiV2" class="btn-load">Cargar desde WordPress</button>
      <button type="button" id="btnExportarCsvV2" class="btn-secondary">Exportar CSV</button>
      <button type="button" id="btnNuevoEventoV2" class="btn-block">Nuevo evento</button>
    </div>
  </section>

  <section class="admin-v2-status">
    <span id="wpAuthFlagV2" class="auth-pill state-pending">Sin verificar</span>
    <span id="wpAuthDetailsV2" class="auth-details">Comprobando autenticacion y permisos...</span>
    <span id="contadorEventosV2" class="contador-eventos">0 eventos</span>
  </section>

  <section id="calendario-admin-v2" class="calendario-grid"></section>

  <section class="filtros-container">
    <div class="filtro-grupo">
      <label>Filtrar por Tipo de Evento:</label>
      <div id="filtro-tipo-container-v2" class="checkbox-group-box"></div>
    </div>

    <div class="filtro-grupo">
      <label>Filtrar por Ubicaci&#243;n:</label>
      <div id="filtro-lugar-container-v2" class="checkbox-group-box"></div>
    </div>
  </section>

  <section class="api-log-wrap">
    <div class="api-log-header">
      <strong>Registro API</strong>
      <button type="button" id="btnLimpiarLogV2" class="btn-secondary btn-log-clear">Limpiar</button>
    </div>
    <div id="apiLogListV2" class="api-log-list" aria-live="polite"></div>
  </section>
</div>

<div id="modal-admin-v2" class="evento-modal-overlay" aria-hidden="true">
  <div class="evento-modal-card evento-modal-card-form" role="dialog" aria-modal="true" aria-labelledby="modalTitleV2">
    <button type="button" id="btnCerrarModalV2" class="evento-modal-close" aria-label="Cerrar">x</button>
    <div class="evento-modal-content evento-modal-content-form">
      <h3 id="modalTitleV2" class="evento-modal-title">Nuevo evento</h3>
      <p id="modalSubtitleV2" class="modal-subtitle">Completa los campos para crear o actualizar el evento.</p>

      <div id="mensajeEstadoV2" class="mensaje-estado" role="status" aria-live="polite"></div>

      <form id="formEventoV2">
        <div class="form-group">
          <label for="fTituloV2">Titulo del Evento *</label>
          <input type="text" id="fTituloV2" required placeholder="Ej. Maraton MTB Desierto">
        </div>

        <div class="form-row">
          <div class="form-group">
            <label for="fFechaV2">Fecha y Hora *</label>
            <input type="datetime-local" id="fFechaV2" required>
          </div>
          <div class="form-group">
            <label for="fEstadoV2">Estado (YUC / CAM / QROO)</label>
            <select id="fEstadoV2">
              <option value="YUC">YUC</option>
              <option value="CAM">CAM</option>
              <option value="QROO">QROO</option>
            </select>
          </div>
        </div>

        <div class="form-group">
          <label for="fLugarV2">Lugar / Ubicaci&#243;n</label>
          <input type="text" id="fLugarV2" placeholder="Ej. Merida, Yucatan">
        </div>

        <div class="form-row">
          <div class="form-group">
            <label for="fTiposV2">Tipos (separados por coma)</label>
            <input type="text" id="fTiposV2" placeholder="Ej. MTB, Running">
          </div>
          <div class="form-group">
            <label for="fDistanciasV2">Distancias</label>
            <input type="text" id="fDistanciasV2" placeholder="Ej. 5 km, 10 km">
          </div>
        </div>

        <div class="form-row">
          <div class="form-group">
            <label for="fLinkV2">Enlace de Informacion (URL)</label>
            <input type="url" id="fLinkV2" placeholder="https://...">
          </div>
        </div>

        <div class="form-group">
          <label for="fInscripcionOnLineV2">InscripcionesOnLine (URL)</label>
          <input type="url" id="fInscripcionOnLineV2" placeholder="https://...">
        </div>

        <div class="form-group">
          <label for="fWhatsappV2">Whatsapp (multiples telefonos)</label>
          <textarea id="fWhatsappV2" rows="2" placeholder="529991234567, 529991112223"></textarea>
        </div>

        <div class="form-group">
          <label for="fDescripcionV2">Descripcion</label>
          <textarea id="fDescripcionV2" rows="4" placeholder="Detalles del evento..."></textarea>
        </div>

        <div class="form-row">
          <div class="form-group">
            <label for="fOrganizadorV2">Organizador</label>
            <input type="text" id="fOrganizadorV2" placeholder="Empresa o persona responsable">
          </div>

          <div class="form-group">
            <label for="fImagenV2">URL de la Imagen</label>
            <input type="url" id="fImagenV2" placeholder="https://...">
          </div>
        </div>

        <div class="imagen-preview-wrap">
          <img id="previewImagenV2" class="imagen-preview" alt="Vista previa de la imagen">
          <p id="previewImagenV2Empty" class="imagen-preview-empty">Sin vista previa de imagen</p>
        </div>

        <div class="form-actions">
          <button type="button" id="btnEliminarEventoV2" class="btn-table-delete" style="display:none;">Eliminar</button>
          <button type="button" id="btnCancelarModalV2" class="btn-secondary">Cancelar</button>
          <button type="submit" id="btnGuardarEventoV2" class="btn-block">Guardar evento</button>
        </div>
      </form>
    </div>
  </div>
</div>
