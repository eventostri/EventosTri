<?php
/**
 * Fallback template for environments that cannot load block templates.
 */
?><!doctype html>
<html <?php language_attributes(); ?>>
<head>
    <meta charset="<?php bloginfo('charset'); ?>">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <?php wp_head(); ?>
</head>
<body <?php body_class(); ?>>
<?php wp_body_open(); ?>
<div class="site-container">
    <header class="site-header">
        <?php if (function_exists('has_custom_logo') && has_custom_logo()) : ?>
            <?php the_custom_logo(); ?>
        <?php endif; ?>
        <div class="site-info">
            <h1 class="site-title"><?php bloginfo('name'); ?></h1>
            <p class="site-description"><?php bloginfo('description'); ?></p>
        </div>
    </header>
    <main>
        <?php
        if (have_posts()) :
            while (have_posts()) : the_post();
                the_content();
            endwhile;
        endif;
        ?>
    </main>
</div>
<?php wp_footer(); ?>
</body>
</html>