document.addEventListener('DOMContentLoaded', function() {
  // Elements
  const trainerSelect = document.getElementById('trainer');
  const dateInput = document.getElementById('date');
  const timeSelect = document.getElementById('time');
  const termsCheck = document.getElementById('termsCheck');
  const agreeButton = document.getElementById('agreeButton');
  const bookButton = document.getElementById('bookButton');
  
  // Available time slots (in a real app, this would come from the server based on trainer availability)
  const timeSlots = [
    "07:00 AM", "08:00 AM", "09:00 AM", "10:00 AM", "11:00 AM", 
    "01:00 PM", "02:00 PM", "03:00 PM", "04:00 PM", "05:00 PM", 
    "06:00 PM", "07:00 PM"
  ];
  
  // Set min date to today
  const today = new Date();
  const yyyy = today.getFullYear();
  const mm = String(today.getMonth() + 1).padStart(2, '0');
  const dd = String(today.getDate()).padStart(2, '0');
  const formattedDate = `${yyyy}-${mm}-${dd}`;
  dateInput.min = formattedDate;
  
  // Initialize time slots
  function populateTimeSlots() {
    // Clear existing options
    timeSelect.innerHTML = '<option value="" selected disabled>Choose a time slot...</option>';
    
    // Add time slots
    timeSlots.forEach(slot => {
      const option = document.createElement('option');
      option.value = slot;
      option.textContent = slot;
      timeSelect.appendChild(option);
    });
  }
  
  // Event listener for trainer selection
  trainerSelect.addEventListener('change', function() {
    // In a real app, you'd fetch available times for the selected trainer
    populateTimeSlots();
    validateForm();
  });
  
  // Event listener for date selection
  dateInput.addEventListener('change', function() {
    // In a real app, you'd fetch available times for the selected date and trainer
    if (trainerSelect.value) {
      populateTimeSlots();
    }
    validateForm();
  });
  
  // Event listener for time selection
  timeSelect.addEventListener('change', validateForm);
  
  // Event listener for terms checkbox
  termsCheck.addEventListener('change', validateForm);
  
  // Click handler for "I Agree" button in the modal
  agreeButton.addEventListener('click', function() {
    termsCheck.checked = true;
    validateForm();
  });
  
  // Form validation
  function validateForm() {
    const isValid = 
      trainerSelect.value && 
      dateInput.value && 
      timeSelect.value && 
      termsCheck.checked;
    
    bookButton.disabled = !isValid;
    
    // Apply visual styles based on validation
    if (isValid) {
      bookButton.classList.remove('btn-secondary');
      bookButton.classList.add('btn-danger');
    } else {
      bookButton.classList.remove('btn-danger');
      bookButton.classList.add('btn-secondary');
    }
  }
  
  // Initial validation
  validateForm();
  
  // Prevent form submission if invalid
  document.getElementById('bookingForm').addEventListener('submit', function(event) {
    
    if (!trainerSelect.value || !dateInput.value || !timeSelect.value || !termsCheck.checked) {
      event.preventDefault();
      alert('Please fill in all required fields and accept the terms and conditions');
    }
  });

  // Make sure the form action is correct
  const bookingForm = document.getElementById('bookingForm');
  
  if (bookingForm) {
    bookingForm.setAttribute('action', '/user/book');
  }
});