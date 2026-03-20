document.getElementById('timeForm').addEventListener('submit', function(event) {
  event.preventDefault();

  // Get user input
  const destination = document.getElementById('destination').value;
  const eventTime = new Date(document.getElementById('eventTime').value);
  const travelTime = parseInt(document.getElementById('travelTime').value);

  if (!destination || !eventTime || isNaN(travelTime)) {
      alert('Please fill in all fields correctly.');
      return;
  }

  // Calculate the best time to leave
  const leaveTime = new Date(eventTime.getTime() - travelTime * 6000);

  // Format the leave time
  const formattedLeaveTime = `${leaveTime.getHours().toString().padStart(2, '0')}:${leaveTime.getMinutes().toString().padStart(2, '0')}`;

  // Display result
  const resultEl = document.getElementById('result');
  resultEl.textContent = `Best time to leave for ${destination} is at ${formattedLeaveTime}.`;
});
