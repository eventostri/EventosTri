<div class="eventostri-admin-v2">
  <section class="admin-v2-topbar">
    <div>
      <h2>Eventos</h2>
      <p>Calendario modificable</p>
    </div>
    <div class="admin-v2-actions">
      <button type="button" id="btnVerificarSesionV2" class="btn-secondary"><?php echo esc_html(eventostri_get_calendar_label('verify_session')); ?></button>
      <button type="button" id="btnCargarApiV2" class="btn-load">Cargar desde WordPress</button>
      <button type="button" id="btnImportarCsvV2" class="btn-secondary"><?php echo esc_html(eventostri_get_calendar_label('import_csv')); ?></button>
      <button type="button" id="btnExportarCsvV2" class="btn-secondary"><?php echo esc_html(eventostri_get_calendar_label('export_csv')); ?></button>
      <button type="button" id="btnEliminarPasadosV2" class="btn-secondary"><?php echo esc_html(eventostri_get_calendar_label('delete_past')); ?></button>
      <button type="button" id="btnNuevoEventoV2" class="btn-block"><?php echo esc_html(eventostri_get_calendar_label('new_event')); ?></button>
      <input type="file" id="inputCsvV2" accept=".csv,text/csv" style="display:none;">
    </div>
  </section>

  <section class="admin-v2-status">
    <span id="wpAuthFlagV2" class="auth-pill state-pending">Sin verificar</span>
    <span id="wpAuthDetailsV2" class="auth-details">Comprobando autenticación y permisos...</span>
    <span id="contadorEventosV2" class="contador-eventos">0 eventos</span>
  </section>

  <section class="admin-v2-search search-container">
    <div class="search-input-wrap">
      <input
        type="text"
        id="evento-search-input-admin-v2"
        placeholder="Buscar eventos por nombre..."
        autocomplete="off"
        aria-label="Buscar eventos en admin"
        aria-autocomplete="list"
        aria-expanded="false"
        aria-controls="evento-search-inline-results-admin-v2">
      <button type="button" id="clear-search-admin-v2" aria-label="Limpiar busqueda" style="display:none;">x</button>
      <ul id="evento-search-inline-results-admin-v2" class="evento-search-inline-results" role="listbox" aria-label="Resultados de busqueda en admin" hidden></ul>
    </div>
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
      <h3 id="modalTitleV2" class="evento-modal-title"><?php echo esc_html(eventostri_get_calendar_label('new_event')); ?></h3>
      <p id="modalSubtitleV2" class="modal-subtitle">Completa los campos para crear o actualizar el evento.</p>

      <div id="mensajeEstadoV2" class="mensaje-estado" role="status" aria-live="polite"></div>

      <form id="formEventoV2">
        <div class="form-group">
          <label for="fTituloV2">Título del evento *</label>
          <input type="text" id="fTituloV2" required placeholder="Ej. Maratón MTB Desierto">
        </div>

        <div class="form-row">
          <div class="form-group">
            <label for="fFechaV2">Fecha y Hora *</label>
            <input type="datetime-local" id="fFechaV2" required>
          </div>
          <div class="form-group">
            <label for="fLugarV2">Lugar / Ubicación</label>
            <input type="text" id="fLugarV2" placeholder="Ej. Mérida">
          </div>
        </div>

        <div class="form-group">
          <label for="fEstadoV2">Estado (YUC / CAM / QROO)</label>
          <select id="fEstadoV2">
            <option value="YUC">YUC</option>
            <option value="CAM">CAM</option>
            <option value="QROO">QROO</option>
          </select>
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
            <label for="fLinkV2">Enlace de información (URL)</label>
            <input type="url" id="fLinkV2" placeholder="https://...">
          </div>
        </div>

        <div class="form-group">
          <label for="fInscripcionOnLineV2">Inscripciones en línea (URL)</label>
          <input type="url" id="fInscripcionOnLineV2" placeholder="https://...">
        </div>

        <div class="form-group">
          <label for="fWhatsappV2">WhatsApp (múltiples teléfonos)</label>
          <textarea id="fWhatsappV2" rows="2" placeholder="529991234567, 529991112223"></textarea>
        </div>

        <div class="form-group">
          <label for="fDescripcionV2">Descripción</label>
          <textarea id="fDescripcionV2" rows="4" placeholder="Detalles del evento..."></textarea>
        </div>

        <div class="form-group">
          <label class="checkbox-inline">
            <input type="checkbox" id="fVisibleEnCalendarioV2">
            Mostrar en calendario público
          </label>
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
          <button type="button" id="btnEliminarEventoV2" class="btn-table-delete" style="display:none;"><?php echo esc_html(eventostri_get_calendar_label('delete')); ?></button>
          <button type="button" id="btnCancelarModalV2" class="btn-secondary"><?php echo esc_html(eventostri_get_calendar_label('cancel')); ?></button>
          <button type="submit" id="btnGuardarEventoV2" class="btn-block"><?php echo esc_html(eventostri_get_calendar_label('save')); ?></button>
        </div>
      </form>
    </div>
  </div>
</div>
