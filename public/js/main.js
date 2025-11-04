document.addEventListener('DOMContentLoaded', function() {
    console.log("FitSync Frontend JS loaded!");
    
    // Add fade-in animation to main content
    const mainContent = document.querySelector('main');
    if (mainContent) {
      mainContent.classList.add('fade-in');
    }
    
    // Add ripple effect to buttons
    const buttons = document.querySelectorAll('.btn');
    buttons.forEach(button => {
      button.addEventListener('click', function(e) {
        const x = e.clientX - e.target.offsetLeft;
        const y = e.clientY - e.target.offsetTop;
        
        const ripple = document.createElement('span');
        ripple.style.left = `${x}px`;
        ripple.style.top = `${y}px`;
        ripple.classList.add('ripple');
        
        this.appendChild(ripple);
        
        setTimeout(() => {
          ripple.remove();
        }, 600);
      });
    });
    
    // Form validation enhancement
    const forms = document.querySelectorAll('form');
    forms.forEach(form => {
      form.addEventListener('submit', function(event) {
        if (!form.checkValidity()) {
          event.preventDefault();
          event.stopPropagation();
          
          // Create custom error styling
          const inputs = form.querySelectorAll('input, select, textarea');
          inputs.forEach(input => {
            if (!input.checkValidity()) {
              input.classList.add('is-invalid');
              
              // Add error message if not exists
              let errorDiv = input.nextElementSibling;
              if (!errorDiv || !errorDiv.classList.contains('invalid-feedback')) {
                errorDiv = document.createElement('div');
                errorDiv.classList.add('invalid-feedback');
                errorDiv.innerText = input.validationMessage;
                input.parentNode.insertBefore(errorDiv, input.nextSibling);
              }
            }
          });
        }
        
        form.classList.add('was-validated');
      });
      
      // Clear validation styling on input
      const inputs = form.querySelectorAll('input, select, textarea');
      inputs.forEach(input => {
        input.addEventListener('input', function() {
          if (this.checkValidity()) {
            this.classList.remove('is-invalid');
            this.classList.add('is-valid');
          }
        });
      });
    });
    
    // Add animation to cards
    const cards = document.querySelectorAll('.card, .dashboard-panel');
    if (cards.length > 0) {
      const observer = new IntersectionObserver(entries => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            entry.target.classList.add('fade-in');
            observer.unobserve(entry.target);
          }
        });
      }, { threshold: 0.1 });
      
      cards.forEach(card => {
        observer.observe(card);
      });
    }
    
    // Dashboard stat counters - animate numbers
    const statElements = document.querySelectorAll('.dashboard-stat');
    if (statElements.length > 0) {
      statElements.forEach(stat => {
        const target = parseInt(stat.getAttribute('data-target'), 10);
        const duration = 1500; // milliseconds for animation
        const step = target / (duration / 16); // update every ~16ms
        let current = 0;
        
        const updateCounter = () => {
          current += step;
          if (current < target) {
            stat.textContent = Math.ceil(current);
            requestAnimationFrame(updateCounter);
          } else {
            stat.textContent = target;
          }
        };
        
        updateCounter();
      });
    }
  });
