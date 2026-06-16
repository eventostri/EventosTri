<!DOCTYPE html>
<html <?php language_attributes(); ?>>
<head>
    <meta charset="<?php bloginfo( 'charset' ); ?>">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <?php wp_head(); ?>
    <style>
        .site-header { display: flex; align-items: center; padding: 20px 0; border-bottom: 1px solid #eee; margin-bottom: 30px; }
        .custom-logo { 
                width: 60px !important;    /* Ajusta este valor al tamaño que quieras */
                height: auto !important;   /* Mantiene la proporción automáticamente */
                margin-right: 20px; 
            }
        .site-info { display: flex; flex-direction: column; }
        .site-title { margin: 0; font-size: 1.5rem; color: #0056b3; }
        .site-description { margin: 0; font-size: 0.9rem; color: #666; }
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