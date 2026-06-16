<!DOCTYPE html>
<html <?php language_attributes(); ?>>
<head>
    <meta charset="<?php bloginfo( 'charset' ); ?>">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <?php wp_head(); ?>
    <style>
        /* Forzamos al contenedor principal de WordPress a no limitar la altura */
        html, body { height: 100%; margin: 0; }        
        /* Compactar header */
        /* Aseguramos que el encabezado no se colapse */
        .site-header { 
            display: flex; 
            align-items: center; 
            padding: 10px !important; 
            border-bottom: none !important;
            width: 100%; 
            box-sizing: border-box;
        }
        .custom-logo { 
                width: 60px !important;    /* Ajusta este valor al tamaño que quieras */
                height: auto !important;   /* Mantiene la proporción automáticamente */
                margin-right: 20px; 
            }

        /* Título y descripción en una línea (texto truncado si es muy largo) */
        /* El contenedor de texto ocupa el resto del espacio disponible */
        .site-info { 
            flex: 1; 
            min-width: 0; /* Vital para que el texto truncado funcione */
        }
        .site-title { 
            font-size: 1.2rem !important; 
            white-space: nowrap; 
            overflow: hidden; 
            text-overflow: ellipsis; 
            margin: 0;
        }
        
        .site-description { 
            font-size: 0.8rem !important; 
            white-space: nowrap; 
            overflow: hidden; 
            text-overflow: ellipsis; 
            margin: 0;
        }

        /* Forzamos al calendario a expandirse */
        .wrapper-eventos { 
            display: flex; 
            flex-direction: column; 
            min-height: 90vh; /* Ocupa el 90% de la altura visible */
        }
        #calendario { 
            width: 100% !important; 
            min-height: 80vh; /* Ocupa el 80% de la altura de la pantalla */
            margin: 0 !important; 
            flex-grow: 1; /* Esto hace que el calendario se "estire" para llenar el contenedor */
            height: 100% !important; 
            min-height: 700px; /* Asegura un tamaño mínimo decente */            
        }
        
        /* Eliminar espacio entre header y calendario */
        .site-container { margin-top: 0 !important; }
        
        /* Compactar controles de calendario */
        .fc-header-toolbar { margin-bottom: 5px !important; }
        /* Aplica mayúscula inicial a los títulos de los meses y días */
        .fc-toolbar-title, 
        .fc-col-header-cell-cushion, 
        .fc-list-day-text, 
        .fc-list-day-side-text {
            text-transform: capitalize !important;
        }
        /* Ajuste para que las celdas sean grandes y usen el espacio */
        .fc-daygrid-body { height: 100% !important; }
        .fc-scrollgrid-sync-table { height: 100% !important; }        
    </style>
</head>
<body>
    <div class="site-container">
        <header class="site-header">
            <?php 
            // Solo ejecutamos esto si hay un logo subido en el administrador
            if ( function_exists('has_custom_logo') && has_custom_logo() ) {
                the_custom_logo();
            }
            ?>
            <div class="site-info">
                <h1 class="site-title"><?php bloginfo('name'); ?></h1>
                <p class="site-description"><?php bloginfo('description'); ?></p>
            </div>
        </header>
        <main>
            <?php
            if ( have_posts() ) :
                while ( have_posts() ) : the_post();
                    the_content();
                endwhile;
            endif;
            ?>
        </main>
    </div>
    <?php wp_footer(); ?>
</body>
</html>